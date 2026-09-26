export type PhotoVariant = "original" | "thumb" | "hero";

export const PHOTO_VARIANT_SETTINGS = {
  thumb: { maxEdge: 640, quality: 78 },
  hero: { maxEdge: 1920, quality: 82 },
} as const;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ORIGINAL_KEY = new RegExp(`^${UUID}/[^/?#\\\\]+\\.(?:jpe?g|png|webp|gif|avif|heic|heif)$`, "i");
const DERIVED_KEY = /\.(?:thumb|hero)\.webp$/i;

function isOriginalPhotoKey(key: string): boolean {
  return ORIGINAL_KEY.test(key) && !DERIVED_KEY.test(key);
}

export function photoVariantKey(key: string, variant: Exclude<PhotoVariant, "original">): string {
  if (!isOriginalPhotoKey(key)) throw new Error("Invalid managed photo key");
  return `${key}.${variant}.webp`;
}

export function photoDeletionKeys(key: string): string[] {
  if (!isOriginalPhotoKey(key)) return [key];
  return [photoVariantKey(key, "thumb"), photoVariantKey(key, "hero"), key];
}

export function photoVariantUrl(url: string, variant: PhotoVariant, base: string): string {
  if (variant === "original" || !base) return url;
  const prefix = `${base.replace(/\/$/, "")}/`;
  if (!url.startsWith(prefix)) return url;
  const key = url.slice(prefix.length);
  if (!isOriginalPhotoKey(key)) return url;
  return `${prefix}${photoVariantKey(key, variant)}`;
}
