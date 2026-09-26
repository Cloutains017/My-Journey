import assert from "node:assert/strict";
import { test } from "node:test";
import { photoDeletionKeys, photoVariantKey, photoVariantUrl } from "../src/lib/photo-variants.ts";

const id = "11111111-1111-4111-8111-111111111111";
const photo = `${id}/22222222-2222-4222-8222-222222222222.jpg`;
const base = "https://photos.example.test";

test("managed originals map to deterministic thumbnail and hero objects", () => {
  assert.equal(photoVariantKey(photo, "thumb"), `${photo}.thumb.webp`);
  assert.equal(photoVariantKey(photo, "hero"), `${photo}.hero.webp`);
  assert.equal(photoVariantUrl(`${base}/${photo}`, "thumb", base), `${base}/${photo}.thumb.webp`);
  assert.equal(photoVariantUrl(`${base}/${photo}`, "hero", base), `${base}/${photo}.hero.webp`);
  assert.equal(photoVariantUrl(`${base}/${photo}`, "original", base), `${base}/${photo}`);
  const legacy = `${id}/1789919685017-IMG_5509.jpeg`;
  assert.equal(photoVariantUrl(`${base}/${legacy}`, "thumb", base), `${base}/${legacy}.thumb.webp`);
});

test("external covers and noncanonical URLs stay on their original address", () => {
  for (const url of [
    "https://other.test/cover.jpg",
    `${base}/${photo}?token=one`,
    `${base}/other/cover.jpg`,
    `${base}/other/${photo}`,
  ]) {
    assert.equal(photoVariantUrl(url, "thumb", base), url);
  }
  assert.throws(() => photoVariantKey("../photo.jpg", "thumb"));
  assert.throws(() => photoVariantKey(`${photo}.thumb.webp`, "thumb"));
  assert.equal(photoVariantUrl(`${base}/${photo}.thumb.webp`, "hero", base), `${base}/${photo}.thumb.webp`);
});

test("permanent deletion removes derived objects before the original", () => {
  assert.deepEqual(photoDeletionKeys(photo), [
    `${photo}.thumb.webp`,
    `${photo}.hero.webp`,
    photo,
  ]);
  assert.deepEqual(photoDeletionKeys("older/cover.jpg"), ["older/cover.jpg"]);
});
