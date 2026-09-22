import assert from "node:assert/strict";
import { test } from "node:test";
import { toRecycleEntry } from "../src/lib/recycle-entry.ts";

test("photo archives expose a thumbnail preview without returning the archived payload", () => {
  const entry = toRecycleEntry({
    id: "archive-1",
    target: "photos",
    label: "照片",
    created_at: "2026-09-22T08:00:00.000Z",
    payload: {
      photos: [{
        id: "photo-1",
        url: "https://images.example.com/trip/photo.webp",
        caption: "山间云海",
        width: 1600,
        height: 1200,
      }],
    },
  });

  assert.deepEqual(entry, {
    id: "archive-1",
    target: "photos",
    label: "照片",
    created_at: "2026-09-22T08:00:00.000Z",
    preview: {
      url: "https://images.example.com/trip/photo.webp",
      caption: "山间云海",
      width: 1600,
      height: 1200,
    },
  });
  assert.equal("payload" in entry, false);
});

test("non-photo archives and malformed photo snapshots do not expose previews", () => {
  const trip = toRecycleEntry({
    id: "archive-2",
    target: "trips",
    label: "黄山之旅",
    created_at: "2026-09-22T08:00:00.000Z",
    payload: { trips: [{ title: "黄山之旅" }] },
  });
  const malformedPhoto = toRecycleEntry({
    id: "archive-3",
    target: "photos",
    label: "照片",
    created_at: "2026-09-22T08:00:00.000Z",
    payload: { photos: [{ url: "", caption: 42 }] },
  });

  assert.equal(trip.preview, undefined);
  assert.equal(malformedPhoto.preview, undefined);
});
