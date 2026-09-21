import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;`);
  await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/security.sql', import.meta.url), 'utf8'));
  return db;
}
const trip = '11111111-1111-4111-8111-111111111111';
const photo = '22222222-2222-4222-8222-222222222222';
async function seed(db: PGlite) {
  await db.exec(`insert into trips(id,title,slug,date,location,latitude,longitude,rating,cover_image)
    values ('${trip}','测试','test','2026-01-01','福州市',1,1,3,'https://photos.test/a.jpg');
    insert into photos(id,trip_id,url) values ('${photo}','${trip}','https://photos.test/a.jpg');
    insert into agreement_votes(trip_id,nickname,agreement) values ('${trip}','游客',3);`);
}
test('database limits concurrent login attempts and hides security records from public roles', async () => {
  const db = await database();
  try {
    await db.exec('set role service_role');
    const attempts = await Promise.all(Array.from({ length: 11 }, () => db.query<{ allowed: boolean }>("select public.admin_login_attempt('test-source') as allowed")));
    assert.equal(attempts.filter(r => r.rows[0].allowed).length, 10);
    await db.exec("update admin_login_limits set window_start = now() - interval '16 minutes'");
    assert.equal((await db.query<{ allowed: boolean }>("select admin_login_attempt('test-source') as allowed")).rows[0].allowed, true);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`reset role; set role ${role}`);
      for (const sql of ["select admin_login_attempt('other')", 'select * from admin_recycle_bin', 'select * from admin_audit_log', 'delete from trips', 'update city_boundaries set name = name']) {
        await assert.rejects(db.exec(sql), /permission denied/);
      }
      await db.exec('select * from trips; select * from city_boundaries');
    }
  } finally { await db.close(); }
});
test('trip deletion and restore preserve photos/comments and do not overwrite a conflicting trip', async () => {
  const db = await database();
  try {
    await seed(db);
    await db.exec('set role service_role');
    const result = await db.query<{ id: string }>(`select admin_archive_delete('trips','${trip}') as id`);
    const id = result.rows[0].id;
    assert.equal((await db.query('select * from trips')).rows.length, 0);
    assert.equal((await db.query('select * from photos')).rows.length, 0);
    assert.equal((await db.query('select * from admin_recycle_bin')).rows.length, 1);
    await db.exec(`insert into trips(id,title,slug,date,location,latitude,longitude,rating) values ('${trip}','新内容','other','2026-01-01','福州',1,1,3)`);
    await assert.rejects(db.query('select admin_restore($1)', [id]), /duplicate key/);
    assert.equal((await db.query<{ title: string }>('select title from trips')).rows[0].title, '新内容');
    assert.equal((await db.query('select * from admin_recycle_bin where restored_at is null')).rows.length, 1);
    await db.exec(`delete from trips where id = '${trip}'`);
    await db.query('select admin_restore($1)', [id]);
    assert.equal((await db.query('select * from trips')).rows.length, 1);
    assert.equal((await db.query('select * from photos')).rows.length, 1);
    assert.equal((await db.query('select * from agreement_votes')).rows.length, 1);
    await assert.rejects(db.query('select admin_restore($1)', [id]), /not available/);
  } finally { await db.close(); }
});
test('photo deletion clears broken cover; restore respects a new cover; failed audit rolls back writes', async () => {
  const db = await database();
  try {
    await seed(db);
    await db.exec('set role service_role');
    const { rows } = await db.query<{ id: string }>(`select admin_archive_delete('photos','${photo}') as id`);
    assert.equal((await db.query<{ cover_image: string | null }>('select cover_image from trips')).rows[0].cover_image, null);
    await db.exec("update trips set cover_image = 'https://photos.test/new.jpg'");
    await db.query('select admin_restore($1)', [rows[0].id]);
    assert.equal((await db.query<{ cover_image: string }>('select cover_image from trips')).rows[0].cover_image, 'https://photos.test/new.jpg');
    assert.ok((await db.query("select * from admin_audit_log where action = 'UPDATE' and before_data is not null")).rows.length);
    await db.exec('reset role; revoke insert on admin_audit_log from service_role; set role service_role');
    await assert.rejects(db.exec("update trips set title = 'destroyed'"), /permission denied/);
    assert.equal((await db.query<{ title: string }>('select title from trips')).rows[0].title, '测试');
  } finally { await db.close(); }
});
