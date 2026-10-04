import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uploadPhoto, retryUploadCleanups, readPendingUploadCleanups, rememberUploadCleanup, finishUploadCleanupRetry, type PendingUploadCleanup } from '../src/lib/photo-upload.ts';

const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
const variants = { thumb: new Blob(['thumb'], { type: 'image/webp' }), hero: new Blob(['hero'], { type: 'image/webp' }) };

function uploadService(failure: 'none' | 'variant' | 'register-network' | 'cleanup-network' = 'none') {
  const files = new Set<string>();
  const registered: string[] = [];
  const cleanupRequests: PendingUploadCleanup[] = [];
  const request: typeof fetch = async (url, options) => {
    const path = String(url);
    if (path.endsWith('/presign')) return Response.json({ presignedUrl: 'https://r2.test/original', thumbPresignedUrl: 'https://r2.test/thumb', heroPresignedUrl: 'https://r2.test/hero', publicUrl: 'https://images.test/photo.jpg', cleanupToken: 'receipt' });
    if (path.startsWith('https://r2.test/')) {
      if (path.endsWith('/hero') && (failure === 'variant' || failure === 'cleanup-network')) return new Response('', { status: 503 });
      files.add(path); return new Response('', { status: 200 });
    }
    if (path.endsWith('/register')) {
      const body = JSON.parse(String(options?.body));
      if (body.urls.length !== 1) return Response.json({ error: 'too many' }, { status: 400 });
      registered.push(...body.urls);
      if (failure === 'register-network') throw new Error('response lost');
      return Response.json({ success: true });
    }
    if (path.endsWith('/cleanup')) {
      const body = JSON.parse(String(options?.body)); cleanupRequests.push(body);
      if (failure === 'cleanup-network') throw new Error('offline');
      if (body.registrationAttempted) return Response.json({ status: 'deferred' }, { status: 202 });
      files.clear(); return Response.json({ status: 'cleaned' });
    }
    throw new Error(`unexpected URL ${path}`);
  };
  return { files, registered, cleanupRequests, request };
}

test('two hundred selected photos are registered individually without triggering the batch limit', async () => {
  const service = uploadService();
  const pending: PendingUploadCleanup[] = [];
  for (let n = 0; n < 200; n++) await uploadPhoto('trip', file, variants, entry => pending.push(entry), service.request);
  assert.equal(service.registered.length, 200);
  assert.equal(service.cleanupRequests.length, 0);
  assert.deepEqual(pending, []);
});

test('variant failure cleans partially uploaded objects before reporting the error', async () => {
  const service = uploadService('variant');
  await assert.rejects(uploadPhoto('trip', file, variants, () => {}, service.request), /上传失败/);
  assert.equal(service.files.size, 0);
  assert.equal(service.registered.length, 0);
  assert.equal(service.cleanupRequests[0].registrationAttempted, false);
});

test('lost registration responses preserve files and queue delayed cleanup', async () => {
  const service = uploadService('register-network');
  const pending: PendingUploadCleanup[] = [];
  await assert.rejects(uploadPhoto('trip', file, variants, entry => pending.push(entry), service.request));
  assert.equal(service.files.size, 3);
  assert.equal(service.registered.length, 1);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].registrationAttempted, true);
});

test('cleanup connection failures are queued rather than swallowed', async () => {
  const service = uploadService('cleanup-network');
  const pending: PendingUploadCleanup[] = [];
  await assert.rejects(uploadPhoto('trip', file, variants, entry => pending.push(entry), service.request), /存储检查/);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].registrationAttempted, false);
});

test('cleanup retries remove confirmed successes and preserve deferred or failed work', async () => {
  const entries = ['cleaned', 'protected', 'deferred', 'failed'].map(cleanupToken => ({ cleanupToken, registrationAttempted: true }));
  const request: typeof fetch = async (_url, options) => {
    const { cleanupToken } = JSON.parse(String(options?.body));
    if (cleanupToken === 'failed') throw new Error('offline');
    return Response.json({ status: cleanupToken }, { status: cleanupToken === 'deferred' ? 202 : 200 });
  };
  const remaining = await retryUploadCleanups(entries, request);
  assert.deepEqual(remaining.map(entry => entry.cleanupToken), ['deferred', 'failed']);
});

test('upload receipts are persisted before sending bytes and removed only after confirmed success', async () => {
  let recorded: PendingUploadCleanup | null = null;
  let finished = false;
  const service = uploadService();
  const request: typeof fetch = async (url, options) => {
    if (String(url).startsWith('https://r2.test/')) assert.notEqual(recorded, null, 'closing the tab must leave a retry receipt');
    return service.request(url, options);
  };
  await uploadPhoto('trip', file, variants, () => {}, request, {
    started: entry => { recorded = entry; }, finished: () => { finished = true; },
  });
  assert.equal(finished, true);
});

test('an interrupted original upload waits before cleaning a possibly still-running PUT', async () => {
  const service = uploadService();
  const pending: PendingUploadCleanup[] = [];
  const request: typeof fetch = async (url, options) => {
    if (String(url) === 'https://r2.test/original') throw new Error('connection lost');
    return service.request(url, options);
  };
  await assert.rejects(uploadPhoto('trip', file, variants, entry => pending.push(entry), request));
  assert.equal(pending[0].registrationAttempted, true);
});

test('retry completion preserves receipts added by another tab and tolerates invalid saved data', () => {
  const values = new Map<string, string>();
  const storage = { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const first = { cleanupToken: 'first', registrationAttempted: true };
  rememberUploadCleanup(storage, first);
  const attempted = readPendingUploadCleanups(storage);
  rememberUploadCleanup(storage, { cleanupToken: 'second', registrationAttempted: false });
  finishUploadCleanupRetry(storage, attempted, []);
  assert.deepEqual(readPendingUploadCleanups(storage).map(entry => entry.cleanupToken), ['second']);
  assert.deepEqual(readPendingUploadCleanups({ length: 1, key: () => 'my-journey:pending-upload-cleanup:v2:bad', getItem: () => '{bad json' }), []);
});

test('simultaneous tabs store separate receipts without overwriting each other', () => {
  const values = new Map<string, string>();
  let interleave = true;
  const second = { cleanupToken: 'second', registrationAttempted: true };
  const storage = { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (interleave) { interleave = false; rememberUploadCleanup(storage, second); }
      values.set(key, value);
    }, removeItem: (key: string) => { values.delete(key); },
  };
  rememberUploadCleanup(storage, { cleanupToken: 'first', registrationAttempted: false });
  assert.deepEqual(readPendingUploadCleanups(storage).map(entry => entry.cleanupToken).sort(), ['first', 'second']);
});

test('invalidated receipts stay visible for manual inspection without perpetual network retries', async () => {
  let requests = 0;
  const request: typeof fetch = async () => { requests++; return Response.json({ code: 'invalid_cleanup_receipt' }, { status: 400 }); };
  const remaining = await retryUploadCleanups([{ cleanupToken: 'rotated-secret', registrationAttempted: true }], request);
  assert.equal(remaining[0].manualRequired, true);
  assert.deepEqual(await retryUploadCleanups(remaining, request), remaining);
  assert.equal(requests, 1);
});

test('a frozen tab resumed after the upload window cannot send late registration', async () => {
  const service = uploadService();
  let time = 0;
  const request: typeof fetch = async (url, options) => {
    const response = await service.request(url, options);
    if (String(url) === 'https://r2.test/hero') time = 16 * 60_000;
    return response;
  };
  await assert.rejects(uploadPhoto('trip', file, variants, () => {}, request, undefined, () => time), /超时/);
  assert.equal(service.registered.length, 0);
  assert.equal(service.files.size, 0);
});
