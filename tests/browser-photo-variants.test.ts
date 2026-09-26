import assert from "node:assert/strict";
import { test } from "node:test";
import { makePhotoVariants, scaledDimensions } from "../src/lib/browser-photo-variants.ts";

test("photo variants fit their width limit without enlarging small originals", () => {
  assert.deepEqual(scaledDimensions(4000, 3000, 640), { width: 640, height: 480 });
  assert.deepEqual(scaledDimensions(3000, 4000, 1920), { width: 1440, height: 1920 });
  assert.deepEqual(scaledDimensions(320, 240, 640), { width: 320, height: 240 });
});

test("upload encodes both sizes as WebP and releases the decoded image", async () => {
  const previousBitmap = globalThis.createImageBitmap;
  const previousDocument = globalThis.document;
  const encodes: Array<{ width: number; height: number; type: string; quality: number }> = [];
  let closed = false;
  globalThis.createImageBitmap = async () => ({ width: 3000, height: 2000, close: () => { closed = true; } }) as ImageBitmap;
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage() {}, imageSmoothingQuality: "high" }),
      toBlob(callback: (blob: Blob) => void, type: string, quality: number) {
        encodes.push({ width: this.width, height: this.height, type, quality });
        callback(new Blob(["image"], { type }));
      },
    }),
  } as unknown as Document;
  try {
    const result = await makePhotoVariants(new File(["image"], "photo.jpg", { type: "image/jpeg" }));
    assert.equal(result.thumb.type, "image/webp");
    assert.equal(result.hero.type, "image/webp");
    assert.deepEqual(encodes, [
      { width: 640, height: 427, type: "image/webp", quality: 0.78 },
      { width: 1920, height: 1280, type: "image/webp", quality: 0.82 },
    ]);
    assert.equal(closed, true);
  } finally {
    globalThis.createImageBitmap = previousBitmap;
    globalThis.document = previousDocument;
  }
});
