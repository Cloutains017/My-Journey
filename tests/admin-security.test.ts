import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTrustedAdminRequest, createPhotoKey, registeredPhotoKey, loginSource } from '../src/lib/admin-security.ts';

test('admin writes require exact origin; cross-site and missing origin are rejected', () => {
  const req = (headers: Record<string,string>, method = 'POST') => new Request('https://www.cloutains.top/api/admin/auth', {method, headers});
  assert.equal(isTrustedAdminRequest(req({'origin':'https://www.cloutains.top'})), true);
  for (const origin of ['https://evil.test','null','https://www.cloutains.top.evil.test']) assert.equal(isTrustedAdminRequest(req({origin})), false);
  assert.equal(isTrustedAdminRequest(req({})), false);
  assert.equal(isTrustedAdminRequest(req({origin:'https://www.cloutains.top','sec-fetch-site':'cross-site'})), false);
  assert.equal(isTrustedAdminRequest(req({},'GET')), true);
  assert.equal(isTrustedAdminRequest(new Request('http://localhost:3019/api/admin/auth', { method:'POST', headers:{Host:'127.0.0.1:3019',Origin:'http://127.0.0.1:3019'} })),true);
});
test('uploads use fresh server keys and cannot register foreign URLs or traversal paths', () => {
  const trip = '11111111-1111-4111-8111-111111111111';
  const key = createPhotoKey(trip, 'image/jpeg');
  assert.notEqual(key, createPhotoKey(trip, 'image/jpeg'));
  assert.ok(key.startsWith(trip + '/'));
  assert.equal(registeredPhotoKey('https://img.test/' + key, trip, 'https://img.test'),key);
  for (const url of ['https://evil.test/'+key,'https://img.test/../a.jpg','https://img.test/'+key+'?x=1','https://img.test/other/a.jpg']) assert.throws(()=>registeredPhotoKey(url,trip,'https://img.test'));
  assert.throws(()=>createPhotoKey('../old','image/jpeg'));
  assert.throws(()=>createPhotoKey(trip,'image/svg+xml'));
});
test('untrusted proxy headers cannot rotate local limiter buckets; source is hashed', () => {
  const req = (ip: string) => new Request('http://localhost', {headers:{'x-forwarded-for':ip}});
  assert.equal(loginSource(req('1.2.3.4'),'secret',false),loginSource(req('5.6.7.8'),'secret',false));
  assert.notEqual(loginSource(req('1.2.3.4'),'secret',true),loginSource(req('5.6.7.8'),'secret',true));
  assert.match(loginSource(req('1.2.3.4'),'secret',true),/^[a-f0-9]{64}$/);
});
