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
