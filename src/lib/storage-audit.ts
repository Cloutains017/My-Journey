import { photoDeletionKeys } from './photo-variants.ts';

export type StorageObject = { key: string; size: number; lastModified: string | null };
export type StorageTrip = { id: string; title: string; slug?: string; cover_image?: string | null; content?: string | null };
export type StorageSnapshot = {
  photos: { url: string }[];
  trips: StorageTrip[];
  archives: { restored_at: string | null; payload: unknown }[];
};
export type StorageReferences = { live: Set<string>; recycled: Set<string> };
type Usage = { count: number; bytes: number };
export type StorageAudit = {
  checkedAt: string;
  total: Usage;
  active: Usage;
  recycled: Usage;
  orphan: Usage;
  recent: Usage;
  categories: Record<'original' | 'thumb' | 'hero' | 'other', Usage>;
  files: (StorageObject & { status: 'orphan' | 'recent'; tripTitle: string; tripSlug: string | null })[];
};

// Recent objects may belong to an upload whose database registration is still pending.
export const STORAGE_GRACE_MS = 15 * 60 * 1000;

export function collectStorageReferences(snapshot: StorageSnapshot, publicUrl: string, objectKeys: string[] = [], protectRestoredArchives = false): StorageReferences {
  const base = new URL(publicUrl);
  const prefix = `${base.pathname.replace(/\/$/, '')}/`;
  const live = new Set<string>();
  const recycled = new Set<string>();
  function addUrl(value: string, target: Set<string>) {
    try {
      const url = new URL(value);
      if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) return;
      const key = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/\.(thumb|hero)\.webp$/i, '');
      for (const member of photoDeletionKeys(key)) target.add(member);
    } catch { /* Other strings and external images do not identify managed objects. */ }
  }
  function visit(value: unknown, target: Set<string>) {
    if (typeof value === 'string') {
      addUrl(value, target);
      for (const match of value.matchAll(/https?:\/\/[^\s<>"'\\)]+/g)) addUrl(match[0].replace(/[，。；！？、]+$/, ''), target);
      // Preserve literal URLs in prose even when filenames contain spaces or punctuation.
      for (const key of objectKeys) {
        if (value.includes(`${publicUrl.replace(/\/$/, '')}/${key}`)) addUrl(`${publicUrl.replace(/\/$/, '')}/${key}`, target);
      }
    } else if (Array.isArray(value)) {
      for (const child of value) visit(child, target);
    } else if (value && typeof value === 'object') {
      for (const child of Object.values(value)) visit(child, target);
    }
  }
  visit(snapshot.photos, live);
  visit(snapshot.trips, live);
  for (const archive of snapshot.archives) if (protectRestoredArchives || !archive.restored_at) visit(archive.payload, recycled);
  return { live, recycled };
}

export function auditStorage(objects: StorageObject[], references: StorageReferences, trips: StorageTrip[], now = Date.now()): StorageAudit {
  const usage = (): Usage => ({ count: 0, bytes: 0 });
  const report: StorageAudit = {
    checkedAt: new Date(now).toISOString(), total: usage(), active: usage(), recycled: usage(), orphan: usage(), recent: usage(),
    categories: { original: usage(), thumb: usage(), hero: usage(), other: usage() }, files: [],
  };
  const tripNames = new Map(trips.map(trip => [trip.id, trip]));
  function add(total: Usage, object: StorageObject) { total.count++; total.bytes += object.size; }
  for (const object of objects) {
    add(report.total, object);
    const category = /\.thumb\.webp$/i.test(object.key) ? 'thumb' : /\.hero\.webp$/i.test(object.key) ? 'hero' : /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(object.key) ? 'original' : 'other';
    add(report.categories[category], object);
    if (references.live.has(object.key)) { add(report.active, object); continue; }
    if (references.recycled.has(object.key)) { add(report.recycled, object); continue; }
    const modified = object.lastModified ? Date.parse(object.lastModified) : NaN;
    const status = Number.isFinite(modified) && now - modified >= STORAGE_GRACE_MS ? 'orphan' : 'recent';
    add(report[status], object);
    const trip = tripNames.get(object.key.split('/')[0]);
    report.files.push({ ...object, status, tripTitle: trip?.title ?? '已删除或未知旅程', tripSlug: trip?.slug ?? null });
  }
  report.files.sort((a, b) => b.size - a.size || a.key.localeCompare(b.key));
  return report;
}
