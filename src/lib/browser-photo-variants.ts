export function scaledDimensions(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function encodeVariant(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const { width, height } = scaledDimensions(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法处理图片");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob || blob.type !== "image/webp") throw new Error("浏览器无法生成 WebP 图片，请更换浏览器");
  return blob;
}

export async function makePhotoVariants(file: File): Promise<{ thumb: Blob; hero: Blob }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`无法读取 ${file.name}，请先转换为 JPEG 或 PNG`);
  }
  try {
    const thumb = await encodeVariant(bitmap, PHOTO_VARIANT_SETTINGS.thumb.maxEdge, PHOTO_VARIANT_SETTINGS.thumb.quality / 100);
    const hero = await encodeVariant(bitmap, PHOTO_VARIANT_SETTINGS.hero.maxEdge, PHOTO_VARIANT_SETTINGS.hero.quality / 100);
    return { thumb, hero };
  } finally {
    bitmap.close();
  }
}
import { PHOTO_VARIANT_SETTINGS } from "./photo-variants.ts";
