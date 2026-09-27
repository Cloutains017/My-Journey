import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { restoreDatabase } from "../scripts/restore-database.mjs";
import { restoreR2Objects } from "../scripts/restore-r2.mjs";
import { parseTarget } from "../scripts/restore-target.mjs";

const tripId = "11111111-1111-4111-8111-111111111111";
const secondTripId = "22222222-2222-4222-8222-222222222222";
const photoId = "33333333-3333-4333-8333-333333333333";
const trip = {
  id: tripId, title: "山路", slug: "mountain", date: "2026-09-01", location: "山中",
  latitude: 30, longitude: 120, rating: 4, photo_groups: [],
};
const photo = { id: photoId, trip_id: tripId, url: "https://example.com/photo.jpg", sort_order: 0 };

test("restore inserts related rows, is repeatable, and refuses to overwrite changed data", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    const tables = [
      { table: "trips", rows: [trip] },
      { table: "photos", rows: [photo] },
      { table: "agreement_votes", rows: [] },
      { table: "desire_votes", rows: [] },
      { table: "city_boundaries", rows: [] },
    ];
    await restoreDatabase(db, tables);
    await restoreDatabase(db, tables);
    assert.equal((await db.query<{ n: number }>("select count(*)::int as n from trips")).rows[0].n, 1);
    assert.equal((await db.query<{ n: number }>("select count(*)::int as n from photos")).rows[0].n, 1);

    await db.query("update trips set title = '已修改' where id = $1", [tripId]);
    await assert.rejects(
      restoreDatabase(db, [
        { table: "trips", rows: [trip, { ...trip, id: secondTripId, slug: "second" }] },
        ...tables.slice(1),
      ]),
      /conflict/i,
    );
    assert.equal((await db.query<{ n: number }>("select count(*)::int as n from trips")).rows[0].n, 1);
  } finally {
    await db.close();
  }
});

test("legacy rows use current schema defaults", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    const legacyTrip = Object.fromEntries(Object.entries(trip).filter(([key]) => key !== "photo_groups"));
    const tables = [
      { table: "trips", rows: [legacyTrip] }, { table: "photos", rows: [] },
      { table: "agreement_votes", rows: [] }, { table: "desire_votes", rows: [] },
      { table: "city_boundaries", rows: [] },
    ];
    await restoreDatabase(db, tables);
    await restoreDatabase(db, tables);
    assert.deepEqual((await db.query<{ photo_groups: unknown }>("select photo_groups from trips")).rows[0].photo_groups, []);
  } finally {
    await db.close();
  }
});

test("target checks reject mismatched and unidentified sources", () => {
  const ref = "abcdefghijklmnopqrst";
  const url = `postgresql://postgres:secret@db.${ref}.supabase.co:5432/postgres`;
  const publicUrl = `https://${ref}.supabase.co`;
  assert.equal(parseTarget(url, ref, publicUrl, { supabaseHost: `${ref}.supabase.co` }).hostname, `db.${ref}.supabase.co`);
  assert.throws(() => parseTarget(url, ref, publicUrl, undefined), /Legacy backup/);
  assert.doesNotThrow(() => parseTarget(url, ref, publicUrl, undefined, true));
  assert.throws(() => parseTarget(url.replace(ref, "zyxwvutsrqponmlkjihg"), ref, publicUrl, {}, true), /does not match/);
  assert.throws(() => parseTarget(url.replace(":5432", ":6543"), ref, publicUrl, {}, true), /port 5432/);
});

test("R2 restore adds missing objects and refuses to replace different ones", async () => {
  const directory = await mkdtemp(join(tmpdir(), "my-journey-restore-"));
  try {
    const path = join(directory, "object");
    await writeFile(path, "image");
    const commands: string[] = [];
    const client = { send: async (command: { input: Record<string, unknown> }) => {
      commands.push(command.constructor.name);
      if (command.constructor.name === "HeadObjectCommand") throw { name: "NotFound", $metadata: { httpStatusCode: 404 } };
      assert.equal(command.input.IfNoneMatch, "*");
      return { ETag: '"abc"' };
    } };
    assert.deepEqual(await restoreR2Objects(client, "photos", [{ key: "a", path, bytes: 5 }]), { uploaded: 1, present: 0 });
    assert.deepEqual(commands, ["HeadObjectCommand", "PutObjectCommand"]);
    await assert.rejects(restoreR2Objects({ send: async () => ({ ContentLength: 3, ETag: '"x"' }) }, "photos", [{ key: "a", path, bytes: 5, etag: '"y"' }]), /differs/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
