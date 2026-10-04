import type { SupabaseClient } from '@supabase/supabase-js';
import { collectStorageReferences, type StorageSnapshot, type StorageTrip } from './storage-audit.ts';

export async function readStorageRows<T>(db: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  while (true) {
    let query = db.from(table).select(columns, { count: 'exact' }).order('id');
    if (after) query = query.gt('id', after);
    const { data, error, count } = await query.range(0, 499);
    if (error || count === null || !data) throw new Error('无法完整读取存储引用，请稍后重试');
    rows.push(...data as T[]);
    if (data.length >= count) return rows;
    if (!data.length) throw new Error('存储引用读取不完整，已停止操作');
    const lastId = (data.at(-1) as unknown as { id?: unknown }).id;
    if (typeof lastId !== 'string' || lastId === after) throw new Error('存储引用分页无效，已停止操作');
    after = lastId;
  }
}

export async function loadStorageReferences(db: SupabaseClient, publicUrl: string, objectKeys: string[] = [], protectRestoredArchives = false) {
  const [photos, trips] = await Promise.all([
    readStorageRows<{ url: string }>(db, 'photos', 'id,url'),
    readStorageRows<StorageTrip>(db, 'trips', 'id,title,slug,cover_image,content'),
  ]);
  // Archives are durable across deletion/restoration. Read them after live rows
  // so moving a photo into the recycle bin cannot leave both reads empty.
  const archives = await readStorageRows<StorageSnapshot['archives'][number]>(db, 'admin_recycle_bin', 'id,restored_at,payload');
  return { trips, references: collectStorageReferences({ photos, trips, archives }, publicUrl, objectKeys, protectRestoredArchives) };
}
