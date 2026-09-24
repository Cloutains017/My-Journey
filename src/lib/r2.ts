import { DeleteObjectCommand, S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing Cloudflare R2 env vars");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

export async function r2PhotoInfo(key: string) {
  return getR2Client().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function r2Delete(key: string) {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function r2KeyFromPublicUrl(url: string): string {
  const publicUrl = new URL(PUBLIC_URL);
  const photoUrl = new URL(url);
  const prefix = publicUrl.pathname.replace(/\/$/, "");
  if (photoUrl.origin !== publicUrl.origin || !photoUrl.pathname.startsWith(`${prefix}/`)) {
    throw new Error("照片不在受管 R2 存储中");
  }
  return decodeURIComponent(photoUrl.pathname.slice(prefix.length + 1));
}

export async function r2PresignUpload(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const client = getR2Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}
