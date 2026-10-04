import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectStorageReferences, auditStorage } from '../src/lib/storage-audit.ts';

const base = 'https://images.test/photos';
const trip = '11111111-1111-4111-8111-111111111111';
const key = `${trip}/original.jpg`;
const now = Date.parse('2026-10-04T08:00:00Z');
const old = '2026-10-01T08:00:00Z';

test('storage audit protects originals and variants referenced by photos, covers, prose and restorable archives', () => {
  const references = collectStorageReferences({
    photos: [{ url: `${base}/${key}` }],
    trips: [{ id: trip, title: '旅程', cover_image: `${base}/${trip}/cover.jpg`, content: `![图](${base}/${trip}/body%20image.jpg?x=1)` }],
    archives: [
      { restored_at: null, payload: { photos: [{ url: `${base}/${trip}/deleted.jpg` }], trips: [{ cover_image: `${base}/${trip}/deleted-cover.jpg` }] } },
      { restored_at: '2026-10-01', payload: { photos: [{ url: `${base}/${trip}/restored-old.jpg` }] } },
    ],
  }, base);
  const report = auditStorage([
    { key, size: 100, lastModified: old },
    { key: `${key}.thumb.webp`, size: 10, lastModified: old },
    { key: `${trip}/cover.jpg.hero.webp`, size: 20, lastModified: old },
    { key: `${trip}/body image.jpg`, size: 30, lastModified: old },
    { key: `${trip}/deleted.jpg`, size: 40, lastModified: old },
    { key: `${trip}/deleted-cover.jpg.hero.webp`, size: 50, lastModified: old },
    { key: `${trip}/restored-old.jpg`, size: 60, lastModified: old },
  ], references, [{ id: trip, title: '旅程' }], now);
  assert.deepEqual(report.active, { count: 4, bytes: 160 });
  assert.deepEqual(report.recycled, { count: 2, bytes: 90 });
  assert.deepEqual(report.orphan, { count: 1, bytes: 60 });
  assert.equal(report.files[0].key, `${trip}/restored-old.jpg`);
  assert.equal(report.files[0].tripTitle, '旅程');
});

test('recent and unknown-age objects are kept apart from old unreferenced files', () => {
  const refs = collectStorageReferences({ photos: [], trips: [], archives: [] }, base);
  const report = auditStorage([
    { key: `${trip}/old.jpg`, size: 100, lastModified: old },
    { key: `${trip}/new.jpg`, size: 200, lastModified: '2026-10-04T07:59:00Z' },
    { key: `${trip}/unknown.jpg`, size: 300, lastModified: null },
  ], refs, [], now);
  assert.deepEqual(report.total, { count: 3, bytes: 600 });
  assert.deepEqual(report.orphan, { count: 1, bytes: 100 });
  assert.deepEqual(report.recent, { count: 2, bytes: 500 });
  assert.equal(report.files.filter(file => file.status === 'orphan').length, 1);
});

test('foreign hosts and lookalike path prefixes do not protect unrelated objects', () => {
  const refs = collectStorageReferences({ photos: [{ url: `https://evil.test/photos/${key}` }, { url: `https://images.test/photos-else/${key}` }], trips: [], archives: [] }, base);
  assert.equal(refs.live.size, 0);
});

test('literal prose references with punctuation and encoded keys remain protected', () => {
  const literal = `${trip}/文 图.jpg`;
  const refs = collectStorageReferences({ photos: [], trips: [{ id: trip, title: '正文', content: `查看 ${base}/${literal}。` }], archives: [] }, base, [literal]);
  assert.equal(refs.live.has(literal), true);
  assert.equal(refs.live.has(`${literal}.hero.webp`), true);
});
