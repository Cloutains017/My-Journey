import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUploadCleanupToken, verifyUploadCleanupToken, cleanupFailedUpload, verifyUploadRegistration } from '../src/lib/upload-cleanup.ts';

const key = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg';
const config = { password: 'admin-password', secret: 'signing-secret' };
const now = Date.parse('2026-10-04T08:00:00Z');

test('cleanup receipts cannot be forged and still work after a long offline period', () => {
  const token = createUploadCleanupToken(key, config, now);
  assert.deepEqual(verifyUploadCleanupToken(token, config, now), { key, issuedAt: now });
  assert.equal(verifyUploadCleanupToken(`${token}x`, config, now), null);
  assert.equal(verifyUploadCleanupToken(token, { ...config, password: 'changed' }, now), null);
  assert.deepEqual(verifyUploadCleanupToken(token, config, now + 30 * 86400_000), { key, issuedAt: now });
  assert.throws(() => createUploadCleanupToken('../arbitrary.jpg', config, now));
});

test('failed uploads remove the original and both partial variants', async () => {
  const stored = new Set([key, `${key}.thumb.webp`, `${key}.hero.webp`]);
  const result = await cleanupFailedUpload({ key, issuedAt: now }, false, new Set(), async k => { stored.delete(k); }, now);
  assert.equal(result.status, 'cleaned');
  assert.equal(stored.size, 0);
});

test('any live or recycled family member protects all three files', async () => {
  const stored = new Set([key, `${key}.thumb.webp`, `${key}.hero.webp`]);
  const result = await cleanupFailedUpload({ key, issuedAt: now - 3600_000 }, true, new Set([`${key}.thumb.webp`]), async k => { stored.delete(k); }, now);
  assert.equal(result.status, 'protected');
  assert.equal(stored.size, 3);
});

test('ambiguous registration waits before cleanup and then removes only still-unreferenced objects', async () => {
  const stored = new Set([key]);
  const remove = async (k: string) => { stored.delete(k); };
  assert.equal((await cleanupFailedUpload({ key, issuedAt: now }, true, new Set(), remove, now)).status, 'deferred');
  assert.equal(stored.size, 1);
  assert.equal((await cleanupFailedUpload({ key, issuedAt: now }, true, new Set(), remove, now + 3600_000)).status, 'cleaned');
  assert.equal(stored.size, 0);
});

test('a failed object deletion is reported and can be retried', async () => {
  await assert.rejects(cleanupFailedUpload({ key, issuedAt: now }, false, new Set(), async () => { throw new Error('R2 unavailable'); }, now), /R2 unavailable/);
});

test('registration rejects late receipts and receipts bound to another photo', () => {
  const token = createUploadCleanupToken(key, config, now);
  assert.equal(verifyUploadRegistration(token, [key], config, now), true);
  assert.equal(verifyUploadRegistration(token, [key], config, now + 10 * 60_000), false);
  assert.equal(verifyUploadRegistration(token, [key + '.thumb.webp'], config, now), false);
  assert.equal(verifyUploadRegistration(token, [key, key], config, now), false);
});
