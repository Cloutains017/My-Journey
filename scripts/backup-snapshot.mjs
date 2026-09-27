import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { RESTORE_TABLES } from './restore-database.mjs';

const BUSINESS_TABLES = RESTORE_TABLES.slice(0, 5);
const SHA256 = /^[a-f0-9]{64}$/i;

async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function loadVerifiedSnapshot(directory) {
  const root = await realpath(resolve(directory));
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !manifest.complete || !Array.isArray(manifest.tables) || !Array.isArray(manifest.objects)) {
    throw new Error('Backup is incomplete or unsupported');
  }
  const tableNames = new Set();
  const objectKeys = new Set();
  const tableData = [];
  const objects = [];
  async function pathFor(file) {
    if (typeof file !== 'string') throw new Error('Invalid backup path');
    const path = await realpath(resolve(root, file));
    const rel = relative(root, path);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Path outside backup');
    return path;
  }
  async function check(item) {
    if (!SHA256.test(item.sha256)) throw new Error('Invalid backup checksum');
    const path = await pathFor(item.file);
    if (await digest(path) !== item.sha256) throw new Error(`Checksum mismatch: ${item.file}`);
    return path;
  }
  for (const item of manifest.tables) {
    if (!RESTORE_TABLES.includes(item.table) || tableNames.has(item.table) || item.file !== `${item.table}.json`) {
      throw new Error('Invalid backup table manifest');
    }
    tableNames.add(item.table);
    const path = await check(item);
    const rows = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(rows) || rows.length !== item.count) throw new Error(`Row count mismatch: ${item.table}`);
    tableData.push({ table: item.table, rows });
  }
  for (const table of BUSINESS_TABLES) {
    if (!tableNames.has(table)) throw new Error(`Missing table: ${table}`);
  }
  for (const item of manifest.objects) {
    if (typeof item.key !== 'string' || !item.key || objectKeys.has(item.key) ||
      item.file !== `objects/${createHash('sha256').update(item.key).digest('hex')}` ||
      !Number.isSafeInteger(item.bytes) || item.bytes < 0) {
      throw new Error('Invalid backup object manifest');
    }
    objectKeys.add(item.key);
    const path = await check(item);
    if ((await stat(path)).size !== item.bytes) throw new Error(`Size mismatch: ${item.file}`);
    objects.push({ ...item, path });
  }
  return { root, manifest, tableData, objects };
}

export async function verifyBusinessRestore(tableData) {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    for (const table of BUSINESS_TABLES) {
      const rows = tableData.find(item => item.table === table).rows;
      await db.query(`insert into public.${table} select * from jsonb_populate_recordset(null::public.${table}, $1::jsonb)`, [JSON.stringify(rows)]);
      const result = await db.query(`select count(*)::int as n from public.${table}`);
      if (result.rows[0].n !== rows.length) throw new Error(`Restore count mismatch: ${table}`);
    }
  } finally {
    await db.close();
  }
}
