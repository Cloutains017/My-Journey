import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { makeServerPhotoVariants } from "../src/lib/server-photo-variants.ts";

test("backfill generates bounded WebP images from an existing original", async () => {
  const original = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#4488cc" } }).png().toBuffer();
  const variants = await makeServerPhotoVariants(original);
  const thumb = await sharp(variants.thumb).metadata();
  const hero = await sharp(variants.hero).metadata();
  assert.deepEqual([thumb.format, thumb.width, thumb.height], ["webp", 640, 427]);
  assert.deepEqual([hero.format, hero.width, hero.height], ["webp", 1920, 1280]);
});
