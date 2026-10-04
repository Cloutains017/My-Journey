import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("editorial migration preserves existing trips and enforces summary and position boundaries", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/security.sql", import.meta.url), "utf8"));
    await db.exec("alter table trips drop column summary, drop column cover_card_position, drop column cover_hero_position; insert into trips(title,slug,date,location,latitude,longitude,rating) values ('旧游记','legacy','2026-01-01','福州',1,1,3);");
    const migration = await readFile(new URL("../supabase/migrations/20261004144104_trip_presentation.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    assert.deepEqual((await db.query("select title,summary,cover_card_position,cover_hero_position from trips")).rows[0], { title: "旧游记", summary: null, cover_card_position: null, cover_hero_position: null });
    await db.query("update trips set summary=$1,cover_card_position=$2,cover_hero_position=$3", ["🌄".repeat(120), JSON.stringify({ x: 0, y: 100 }), JSON.stringify({ x: 100, y: 0 })]);
    await assert.rejects(db.query("update trips set summary=$1", ["山".repeat(121)]), /check constraint/);
    for (const field of ["cover_card_position", "cover_hero_position"]) {
      for (const point of [{ x: -1, y: 50 }, { x: 50, y: 101 }, { x: "50", y: 50 }, { x: 50 }, { x: 50, y: 50, other: 1 }, []]) {
        await assert.rejects(db.query(`update trips set ${field}=$1`, [JSON.stringify(point)]), /check constraint/);
      }
    }
  } finally { await db.close(); }
});

test("mobile migration keeps legacy crops and photo recycling restores all three positions", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/security.sql", import.meta.url), "utf8"));
    await db.exec("alter table trips drop column if exists cover_mobile_position; insert into trips(id,title,slug,date,location,latitude,longitude,rating,cover_image,cover_hero_position) values ('00000000-0000-4000-8000-000000000001','旧游记','old-mobile','2026-01-01','福州',1,1,3,'https://photos.test/a.jpg','{\"x\":80,\"y\":20}');");
    const migration = await readFile(new URL("../supabase/migrations/20261004162850_mobile_cover_framing.sql", import.meta.url), "utf8");
    await db.exec(migration); await db.exec(migration);
    assert.deepEqual((await db.query("select cover_hero_position,cover_mobile_position from trips")).rows[0], { cover_hero_position:{x:80,y:20}, cover_mobile_position:null });
    await db.exec("update trips set cover_card_position='{\"x\":10,\"y\":75}',cover_mobile_position='{\"x\":15,\"y\":85}'; insert into photos(id,trip_id,url) values ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','https://photos.test/a.jpg');");
    for (const point of [{x:-1,y:50},{x:20,y:101},{x:'50',y:50},{x:50},{x:50,y:50,other:1},[]]) {
      await assert.rejects(db.query("update trips set cover_mobile_position=$1",[JSON.stringify(point)]),/check constraint/);
    }
    const archived=(await db.query<{ id: string }>("select admin_archive_delete('photos','00000000-0000-4000-8000-000000000002') as id")).rows[0].id;
    assert.deepEqual((await db.query("select cover_card_position,cover_hero_position,cover_mobile_position from trips")).rows[0], {cover_card_position:null,cover_hero_position:null,cover_mobile_position:null});
    await db.exec("update trips set summary='新的摘要',cover_mobile_position='{\"x\":50,\"y\":50}'");
    await db.query("select admin_restore($1)",[archived]);
    assert.deepEqual((await db.query("select summary,cover_card_position,cover_hero_position,cover_mobile_position from trips")).rows[0], {summary:'新的摘要',cover_card_position:{x:10,y:75},cover_hero_position:{x:80,y:20},cover_mobile_position:{x:15,y:85}});
  } finally { await db.close(); }
});
