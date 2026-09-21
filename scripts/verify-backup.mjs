import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

if (!process.argv[2]) throw new Error('Usage: npm run backup:verify -- backups/<snapshot>');
const root = resolve(process.argv[2]);
const manifest = JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
if (manifest.version !== 1 || !manifest.complete) throw new Error('Backup is incomplete or unsupported');
function pathFor(file) {
  const path = resolve(root,file);
  const rel = relative(root,path);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Path outside backup');
  return path;
}
for (const item of [...manifest.tables,...manifest.objects]) {
  const path = pathFor(item.file);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (hash.digest('hex') !== item.sha256) throw new Error(`Checksum mismatch: ${item.file}`);
  if ('bytes' in item && (await stat(path)).size !== item.bytes) throw new Error(`Size mismatch: ${item.file}`);
}
const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  // Import into memory only. No access to production database or credentials.
  for (const table of ['trips','photos','agreement_votes','desire_votes','city_boundaries']) {
    const item = manifest.tables.find(t=>t.table===table);
    if (!item) throw new Error(`Missing table: ${table}`);
    const rows = JSON.parse(await readFile(pathFor(item.file),'utf8'));
    if(rows.length !== item.count) throw new Error(`Row count mismatch: ${table}`);
    await db.query(`insert into ${table} select * from jsonb_populate_recordset(null::${table},$1)`,[JSON.stringify(rows)]);
    const result = await db.query(`select count(*)::int as n from ${table}`);
    if (result.rows[0].n !== item.count) throw new Error(`Restore count mismatch: ${table}`);
    console.log(`Restored in memory: ${table} ${item.count}`);
  }
  console.log(`Verified ${manifest.objects.length} object files; business data restore passed all constraints. Production was not modified.`);
} finally { await db.close(); }
