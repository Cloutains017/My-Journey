import sharp from "sharp";
import { PHOTO_VARIANT_SETTINGS } from "./photo-variants.ts";

export async function makeServerPhotoVariants(original: Buffer): Promise<{ thumb: Buffer; hero: Buffer }> {
  const transform = async ({ maxEdge, quality }: { maxEdge: number; quality: number }) => sharp(original, { animated: false })
    .rotate()
    .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  const [thumb, hero] = await Promise.all([
    transform(PHOTO_VARIANT_SETTINGS.thumb),
    transform(PHOTO_VARIANT_SETTINGS.hero),
  ]);
  return { thumb, hero };
}
