import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PHOTO_MAX_BYTES } from "../src/lib/admin-security.ts";
import { photoVariantKey } from "../src/lib/photo-variants.ts";
import { makeServerPhotoVariants } from "../src/lib/server-photo-variants.ts";

config({ path: resolve(".env.local") });

const apply = process.argv.includes("--apply");
const limitIndex = process.argv.indexOf("--limit");
const limit = limitIndex < 0 ? Infinity : Number(process.argv[limitIndex + 1]);
if (!Number.isInteger(limit) && limit !== Infinity || limit < 1) throw new Error("--limit must be a positive integer");

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucket = process.env.CLOUDFLARE_R2_BUCKET;
const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl || !supabaseUrl || !supabaseKey) {
  throw new Error("Missing R2 or Supabase settings in .env.local");
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});
const supabase = createClient(supabaseUrl, supabaseKey);

function referencedKey(url: string): string | null {
  try {
    const base = new URL(publicUrl!);
    const photo = new URL(url);
    const prefix = `${base.pathname.replace(/\/$/, "")}/`;
    if (photo.origin !== base.origin || photo.search || photo.hash || !photo.pathname.startsWith(prefix)) return null;
    const key = decodeURIComponent(photo.pathname.slice(prefix.length));
    photoVariantKey(key, "thumb");
    return key;
  } catch { return null; }
}

async function livePhotoKeys(): Promise<Set<string>> {
  const urls: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("photos").select("url").order("id").range(offset, offset + 999);
    if (error) throw error;
    urls.push(...(data || []).map((row) => row.url));
    if (!data || data.length < 1000) break;
  }
  const { data: trips, error } = await supabase.from("trips").select("cover_image");
  if (error) throw error;
  urls.push(...(trips || []).map((row) => row.cover_image).filter((url): url is string => !!url));
  return new Set(urls.map(referencedKey).filter((key): key is string => !!key));
}

async function main() {
  const keys = new Set<string>();
  const originals = new Map<string, number>();
  let token: string | undefined;
  do {
    const page = await r2.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const object of page.Contents || []) {
      if (!object.Key) continue;
      keys.add(object.Key);
      try {
        photoVariantKey(object.Key, "thumb");
        originals.set(object.Key, object.Size || 0);
      } catch { /* Not an original managed photo. */ }
    }
    token = page.NextContinuationToken;
  } while (token);

  const active = await livePhotoKeys();
  const pending = [...active].filter((key) => originals.has(key) && (!keys.has(photoVariantKey(key, "thumb")) || !keys.has(photoVariantKey(key, "hero"))))
    .map((key) => [key, originals.get(key)!] as const);
  console.log(`Referenced R2 originals: ${active.size}; missing originals: ${[...active].filter((key) => !originals.has(key)).length}; missing variants: ${pending.length}; mode: ${apply ? "apply" : "dry-run"}`);
  if (!apply) return;

  let completed = 0;
  const failed: string[] = [];
  const selected = pending.slice(0, limit);
  const concurrency = 16;
  for (let index = 0; index < selected.length; index += concurrency) {
    await Promise.all(selected.slice(index, index + concurrency).map(async ([key, size]) => {
      try {
        if (!size || size > PHOTO_MAX_BYTES) throw new Error("Invalid original size");
        const response = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!response.Body) throw new Error("Original has no body");
        const variants = await makeServerPhotoVariants(Buffer.from(await response.Body.transformToByteArray()));
        for (const variant of ["thumb", "hero"] as const) {
          const variantKey = photoVariantKey(key, variant);
          if (keys.has(variantKey)) continue;
          const body = variants[variant];
          await r2.send(new PutObjectCommand({
            Bucket: bucket,
            Key: variantKey,
            Body: body,
            ContentLength: body.length,
            ContentType: "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          }));
          keys.add(variantKey);
        }
        completed++;
      } catch (error) {
        failed.push(key);
        console.error(`Failed ${key}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }));
    console.log(`Processed ${Math.min(index + concurrency, selected.length)}/${selected.length}`);
  }
  console.log(`Completed: ${completed}; failed: ${failed.length}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
