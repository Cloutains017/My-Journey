import { UPLOAD_WINDOW_MS, isUploadWindowOpen } from './upload-policy.ts';

export type PendingUploadCleanup = { cleanupToken: string; registrationAttempted: boolean; manualRequired?: boolean };
const PENDING_PREFIX = 'my-journey:pending-upload-cleanup:v2:';
type QueueReader = Pick<Storage, 'getItem' | 'key' | 'length'>;

export function readPendingUploadCleanups(storage: QueueReader): PendingUploadCleanup[] {
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => !!key?.startsWith(PENDING_PREFIX));
    const entries: PendingUploadCleanup[] = [];
    for (const key of keys) {
      try {
        const entry = JSON.parse(storage.getItem(key) || 'null');
        if (entry && typeof entry.cleanupToken === 'string' && entry.cleanupToken.length <= 1000 && typeof entry.registrationAttempted === 'boolean' && key === PENDING_PREFIX + entry.cleanupToken) entries.push(entry);
      } catch { /* One damaged receipt must not hide the other uploads. */ }
    }
    return entries;
  } catch { return []; }
}

export function rememberUploadCleanup(storage: Pick<Storage, 'setItem'>, entry: PendingUploadCleanup) {
  // Each upload owns a separate record: tabs never rewrite a shared queue.
  storage.setItem(PENDING_PREFIX + entry.cleanupToken, JSON.stringify(entry));
}

export function finishUploadCleanupRetry(storage: Pick<Storage, 'removeItem' | 'setItem'>, attempted: PendingUploadCleanup[], remaining: PendingUploadCleanup[]) {
  const completed = new Set(attempted.filter(entry => !remaining.some(other => other.cleanupToken === entry.cleanupToken)).map(entry => entry.cleanupToken));
  for (const token of completed) storage.removeItem(PENDING_PREFIX + token);
  for (const entry of remaining) if (entry.manualRequired) rememberUploadCleanup(storage, entry);
}

async function cleanupUpload(entry: PendingUploadCleanup, request: typeof fetch): Promise<'done' | 'retry' | 'manual'> {
  const response = await request('/api/admin/photos/cleanup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry), signal: AbortSignal.timeout(75_000),
  });
  const data = await response.json();
  if (response.status === 400 && data.code === 'invalid_cleanup_receipt') return 'manual';
  return response.ok && (data.status === 'cleaned' || data.status === 'protected') ? 'done' : 'retry';
}

export async function retryUploadCleanups(entries: PendingUploadCleanup[], request: typeof fetch = fetch): Promise<PendingUploadCleanup[]> {
  const remaining: PendingUploadCleanup[] = [];
  for (const entry of entries) {
    if (entry.manualRequired) { remaining.push(entry); continue; }
    try {
      const result = await cleanupUpload(entry, request);
      if (result !== 'done') remaining.push(result === 'manual' ? { ...entry, manualRequired: true } : entry);
    }
    catch { remaining.push(entry); }
  }
  return remaining;
}

export async function uploadPhoto(tripId: string, file: File, variants: { thumb: Blob; hero: Blob }, remember: (entry: PendingUploadCleanup) => void, request: typeof fetch = fetch, lifecycle?: { started: (entry: PendingUploadCleanup) => void; finished: (cleanupToken: string) => void }, now = Date.now): Promise<void> {
  let cleanupToken: string | undefined;
  let registrationAttempted = false;
  let requestUncertain = false;
  try {
    const presign = await request('/api/admin/photos/presign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId, contentType: file.type }), signal: AbortSignal.timeout(30_000),
    });
    const upload = await presign.json();
    if (!presign.ok) throw new Error(upload.error || '获取上传凭证失败');
    cleanupToken = upload.cleanupToken;
    if (!cleanupToken) throw new Error('上传清理凭证缺失，请刷新后台后重试');
    // Persist before any PUT: a closed tab cannot run its catch/finally handlers.
    lifecycle?.started({ cleanupToken, registrationAttempted: true });
    const issuedAt = now();
    const uploadDeadline = AbortSignal.timeout(UPLOAD_WINDOW_MS);
    function checkDeadline() {
      if (!isUploadWindowOpen(issuedAt, now())) throw new Error('该张照片上传超时，请重新选择后上传');
    }
    for (const [url, body, contentType] of [
      [upload.presignedUrl, file, file.type], [upload.thumbPresignedUrl, variants.thumb, 'image/webp'], [upload.heroPresignedUrl, variants.hero, 'image/webp'],
    ] as const) {
      checkDeadline();
      requestUncertain = true;
      const response = await request(url, { method: 'PUT', body, headers: { 'Content-Type': contentType }, signal: AbortSignal.any([uploadDeadline, AbortSignal.timeout(5 * 60_000)]) });
      requestUncertain = false;
      if (!response.ok) throw new Error(`上传失败: ${response.status}`);
    }
    checkDeadline();
    registrationAttempted = true;
    const response = await request('/api/admin/photos/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId, urls: [upload.publicUrl], cleanupToken }), signal: AbortSignal.any([uploadDeadline, AbortSignal.timeout(75_000)]),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      // A definite pre-insert rejection can be cleaned immediately. Unknown outcomes wait.
      if (data?.cleanupSafe === true) registrationAttempted = false;
      throw new Error(data?.error || '登记照片失败');
    }
    lifecycle?.finished(cleanupToken);
  } catch (error) {
    const reason = error instanceof Error ? error.message : '上传失败';
    if (!cleanupToken) throw new Error(reason);
    const pending: PendingUploadCleanup = { cleanupToken, registrationAttempted: registrationAttempted || requestUncertain };
    let outcome: 'done' | 'retry' | 'manual' = 'retry';
    try { outcome = await cleanupUpload(pending, request); }
    catch { /* Keep a retry receipt when the cleanup service is unreachable. */ }
    if (outcome === 'done') { lifecycle?.finished(cleanupToken); throw new Error(reason); }
    if (outcome === 'manual') pending.manualRequired = true;
    try { remember(pending); }
    catch { throw new Error(`${reason}；自动清理重试记录无法保存，请到“存储检查”核对`); }
    throw new Error(outcome === 'manual' ? `${reason}；清理凭证已失效，请到“存储检查”核对` : `${reason}；未完成文件将在后台自动重试清理，可到“存储检查”查看`);
  }
}
