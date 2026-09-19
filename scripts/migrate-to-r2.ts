// 将现有照片从 Supabase Storage 迁移到 Cloudflare R2
// 运行: npx tsx scripts/migrate-to-r2.ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dirname, "../.env.local") });
import { createClient } from "@supabase/supabase-js";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
const R2_SECRET = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET },
});

async function main() {
  const { data: photos, error } = await supabase.from("photos").select("*");
  if (error) throw error;
  if (!photos || photos.length === 0) {
    console.log("No photos to migrate.");
    return;
  }

  console.log(`Found ${photos.length} photos to migrate.\n`);

  let migrated = 0;
  let failed = 0;

  for (const photo of photos) {
    try {
      // 跳过已经是 R2 URL 的照片
      if (photo.url.includes("r2.dev")) {
        console.log(`SKIP (already on R2): ${photo.id}`);
        migrated++;
        continue;
      }

      // 从 Supabase 下载
      console.log(`DOWNLOAD: ${photo.url}`);
      const res = await fetch(photo.url);
      if (!res.ok) {
        console.log(`  -> FAILED to download (${res.status})`);
        failed++;
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "image/jpeg";

      // 提取原来的 key（path 部分）
      const url = new URL(photo.url);
      const key = url.pathname.replace("/storage/v1/object/public/trip-photos/", "");

      // 上传到 R2
      console.log(`UPLOAD to R2: ${key}`);
      const upload = new Upload({
        client: r2,
        params: { Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType },
      });
      await upload.done();

      // 更新数据库 URL
      const newUrl = `${R2_PUBLIC_URL}/${key}`;
      const { error: updateError } = await supabase
        .from("photos")
        .update({ url: newUrl })
        .eq("id", photo.id);

      if (updateError) {
        console.log(`  -> FAILED to update DB (${updateError.message})`);
        failed++;
      } else {
        console.log(`  -> OK: ${newUrl}`);
        migrated++;
      }
    } catch (e) {
      console.log(`  -> ERROR: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Failed: ${failed}`);
}

main();
