import assert from "node:assert/strict";
import { test } from "node:test";
import { purgePhotoArchives } from "../src/lib/recycle-purge.ts";

test("permanent purge sends the selected archive ids to the protected recycle-bin API", async () => {
  let request: { url: string; method?: string; body?: string } | undefined;
  const result = await purgePhotoArchives(["a", "b"], async (url, init) => {
    request = { url: String(url), method: init?.method, body: String(init?.body) };
    return Response.json({ success: true, purgedIds: ["a", "b"], failedIds: [] });
  });
  assert.deepEqual(request, { url: "/api/admin/recycle-bin", method: "DELETE", body: '{"ids":["a","b"]}' });
  assert.deepEqual(result, { purgedIds: ["a", "b"], failedIds: [] });
});

test("permanent purge requests every archived photo when clearing all", async () => {
  let body = "";
  const result = await purgePhotoArchives([], async (_url, init) => {
    body = String(init?.body);
    return Response.json({ success: true, purgedIds: ["a"], failedIds: [] });
  }, true);
  assert.equal(body, '{"all":true}');
  assert.deepEqual(result, { purgedIds: ["a"], failedIds: [] });
});
