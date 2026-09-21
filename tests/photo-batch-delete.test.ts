import assert from "node:assert/strict";
import { test } from "node:test";
import { deletePhotos } from "../src/lib/photo-batch-delete.ts";

test("batch deletion removes only confirmed successes and continues after HTTP and network failures", async () => {
  const requests: string[] = [];
  const result = await deletePhotos(["a", "b", "c", "d", "a"], async (url, init) => {
    assert.equal(init?.method, "DELETE");
    requests.push(String(url));
    if (url === "/api/admin/photos/b") return new Response("unavailable", { status: 503 });
    if (url === "/api/admin/photos/c") throw new Error("offline");
    return Response.json({ success: true });
  });
  assert.deepEqual(result, { deletedIds: ["a", "d"], failedIds: ["b", "c"] });
  assert.deepEqual(requests, ["/api/admin/photos/a", "/api/admin/photos/b", "/api/admin/photos/c", "/api/admin/photos/d"]);
});

test("empty selection sends no deletion requests", async () => {
  const result = await deletePhotos([], async () => { throw new Error("must not send"); });
  assert.deepEqual(result, { deletedIds: [], failedIds: [] });
});
