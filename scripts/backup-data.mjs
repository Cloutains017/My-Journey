import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve, join } from 'node:path';

config({ path: '.env.local', quiet: true });
const required = name => {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
  return process.env[name];
};
const digest = async (file, algorithm = 'sha256') => {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
const root = resolve('backups', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(join(root, 'objects'), { recursive: true });
const manifest = { version: 1, startedAt: new Date().toISOString(), complete: false, tables: [], objects: [], skippedTables: [] };
const save = () => writeFile(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
const reuseRoot = process.argv[2] ? resolve(process.argv[2]) : null;
const previous = reuseRoot ? JSON.parse(await readFile(join(reuseRoot,'manifest.json'),'utf8')) : null;
if (previous && !previous.complete) throw new Error('Reuse source must be a verified complete backup');
const oldObjects = new Map((previous?.objects || []).map(item=>[item.key,item]));
await save();
try {
  const db = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
  const tables = ['trips', 'photos', 'agreement_votes', 'desire_votes', 'city_boundaries', 'admin_recycle_bin', 'admin_audit_log'];
  for (const table of tables) {
    const rows = [];
    let skipped = false;
    for (let offset = 0;;) {
      const { data, error } = await db.from(table).select('*').order('id').range(offset, offset + 499);
      if (error) {
        if (table.startsWith('admin_') && error.code === 'PGRST205') {
          manifest.skippedTables.push(table);
          skipped = true;
          break;
        }
        throw new Error(`Cannot export table ${table}: ${error.code}`);
      }
      if (!data.length) break;
      rows.push(...data);
      offset += data.length;
    }
    if (skipped) continue;
    const file = `${table}.json`;
    await writeFile(join(root, file), JSON.stringify(rows));
    manifest.tables.push({ table, file, count: rows.length, sha256: await digest(join(root, file)) });
    console.log(`${table}: ${rows.length} rows`);
    await save();
  }
  const r2 = new S3Client({ region: 'auto', endpoint: `https://${required('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`, credentials: { accessKeyId: required('CLOUDFLARE_R2_ACCESS_KEY_ID'), secretAccessKey: required('CLOUDFLARE_R2_SECRET_ACCESS_KEY') } });
  const Bucket = required('CLOUDFLARE_R2_BUCKET');
  let token;
  do {
    const page = await r2.send(new ListObjectsV2Command({ Bucket, ContinuationToken: token }));
    for (const obj of page.Contents || []) {
      // Never interpret a remote key as a local path.
      const file = `objects/${createHash('sha256').update(obj.Key).digest('hex')}`;
      const prior = oldObjects.get(obj.Key);
      let contentType;
      let reused = false;
      if (reuseRoot && prior?.bytes === obj.Size) {
        // Derive the path from the key, never trust a path from a manifest.
        const oldFile = join(reuseRoot,file);
        if (await digest(oldFile) === prior.sha256) {
          const sameEtag = prior.etag ? prior.etag === obj.ETag : /^"[a-f0-9]{32}"$/i.test(obj.ETag || '') && `"${await digest(oldFile,'md5')}"` === obj.ETag;
          if (sameEtag) { await copyFile(oldFile,join(root,file)); contentType = prior.contentType; reused = true; }
        }
      }
      if (!reused) {
        const response = await r2.send(new GetObjectCommand({ Bucket, Key: obj.Key, IfMatch: obj.ETag }));
        if (!response.Body || response.ContentLength !== obj.Size) throw new Error('Object changed during backup');
        await pipeline(response.Body, createWriteStream(join(root, file), { flags: 'wx' }));
        contentType = response.ContentType;
      }
      manifest.objects.push({ key: obj.Key, file, bytes: obj.Size, etag:obj.ETag, contentType, sha256: await digest(join(root, file)) });
      if (manifest.objects.length % 50 === 0) {
        await save();
        console.log(`R2: ${manifest.objects.length} files saved`);
      }
    }
    token = page.NextContinuationToken;
  } while (token);
  // Re-read every exported file before declaring success.
  for (const item of [...manifest.tables, ...manifest.objects]) {
    if (await digest(join(root, item.file)) !== item.sha256) throw new Error('Backup checksum mismatch');
  }
  for (const item of manifest.tables) {
    if (JSON.parse(await readFile(join(root, item.file), 'utf8')).length !== item.count) throw new Error('Backup row count mismatch');
  }
  manifest.complete = true;
  manifest.finishedAt = new Date().toISOString();
  await save();
  console.log(`Verified backup: ${root} (${manifest.objects.length} objects)`);
} catch (error) {
  await save();
  console.error(`INCOMPLETE backup: ${root}. ${error.message}`);
  process.exitCode = 1;
}
