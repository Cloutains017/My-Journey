import { createHmac, timingSafeEqual } from 'node:crypto';
import { registeredPhotoKey } from './admin-security.ts';
import { photoDeletionKeys } from './photo-variants.ts';
import { STORAGE_GRACE_MS } from './storage-audit.ts';
import { isUploadWindowOpen } from './upload-policy.ts';

type Config = { password?: string; secret?: string };
export type UploadReceipt = { key: string; issuedAt: number };
export type CleanupResult = { status: 'cleaned' | 'protected' | 'deferred' };

function signingKey(config: Config) {
  if (!config.password) throw new Error('ADMIN_PASSWORD must be configured');
  return createHmac('sha256', config.secret || config.password).update(`my-journey:upload-cleanup:${config.password}`).digest();
}

function validKey(key: string) {
  registeredPhotoKey(`https://upload.test/${key}`, key.split('/')[0], 'https://upload.test');
}

export function createUploadCleanupToken(key: string, config: Config, now = Date.now()): string {
  validKey(key);
  const payload = Buffer.from(JSON.stringify({ key, issuedAt: now })).toString('base64url');
  return `${payload}.${createHmac('sha256', signingKey(config)).update(payload).digest('hex')}`;
}

export function verifyUploadCleanupToken(token: unknown, config: Config, now = Date.now()): UploadReceipt | null {
  if (typeof token !== 'string' || token.length > 1000 || !config.password) return null;
  const match = /^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;
  const expected = createHmac('sha256', signingKey(config)).update(match[1]).digest();
  if (!timingSafeEqual(expected, Buffer.from(match[2], 'hex'))) return null;
  try {
    const receipt = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
    // Long offline periods must not strand uploads. Authorization still requires
    // a current admin session, this signed key, and a fresh database reference check.
    if (typeof receipt.key !== 'string' || !Number.isSafeInteger(receipt.issuedAt) || receipt.issuedAt > now + 60_000) return null;
    validKey(receipt.key);
    return { key: receipt.key, issuedAt: receipt.issuedAt };
  } catch { return null; }
}

export async function cleanupFailedUpload(receipt: UploadReceipt, registrationAttempted: boolean, protectedKeys: Set<string>, remove: (key: string) => Promise<unknown>, now = Date.now()): Promise<CleanupResult> {
  const family = photoDeletionKeys(receipt.key);
  if (family.some(key => protectedKeys.has(key))) return { status: 'protected' };
  if (registrationAttempted && now - receipt.issuedAt < STORAGE_GRACE_MS) return { status: 'deferred' };
  for (const key of family) await remove(key);
  return { status: 'cleaned' };
}

export function verifyUploadRegistration(token: unknown, keys: string[], config: Config, now = Date.now()) {
  const receipt = verifyUploadCleanupToken(token, config, now);
  return !!receipt && keys.length === 1 && keys[0] === receipt.key && isUploadWindowOpen(receipt.issuedAt, now);
}
