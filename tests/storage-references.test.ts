import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readStorageRows, loadStorageReferences } from '../src/lib/storage-references.ts';

test('keyset pagination retains the last photo when a previous page row disappears', async () => {
  let rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i).padStart(4, '0') }));
  let calls = 0;
  const db = { from: () => {
    let after = '';
    const query = { select: () => query, order: () => query, gt: (_: string, id: string) => { after = id; return query; }, range: async (start: number, end: number) => {
      const matching = rows.filter(row => row.id > after);
      const result = { data: matching.slice(start, end + 1), count: matching.length, error: null };
      if (++calls === 1) rows = rows.slice(1);
      return result;
    } };
    return query;
  } } as unknown as SupabaseClient;
  const result = await readStorageRows<{ id: string }>(db, 'photos', 'id,url');
  assert.equal(result.at(-1)?.id, '0500');
});

test('cleanup reads durable archive payloads after live rows and protects restored photos', async () => {
  const order: string[] = [];
  const key = '11111111-1111-4111-8111-111111111111/photo.jpg';
  const db = { from: (table: string) => {
    const query = { select: () => query, order: () => query, range: async () => {
      order.push(table);
      const data = table === 'admin_recycle_bin' ? [{ id: 'archive', restored_at: '2026-10-04', payload: { url: `https://images.test/${key}` } }] : [];
      return { data, count: data.length, error: null };
    } };
    return query;
  } } as unknown as SupabaseClient;
  const { references } = await loadStorageReferences(db, 'https://images.test', [], true);
  assert.equal(order.at(-1), 'admin_recycle_bin');
  assert.equal(references.recycled.has(key), true);
});
