// Configure R2 CORS for browser uploads made with presigned URLs.
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAllowedOrigins(value: string): string[] {
  const origins = [...new Set(value.split(",").map((origin) => origin.trim()).filter(Boolean))];

  if (origins.length === 0) {
    throw new Error("R2_CORS_ALLOWED_ORIGINS must contain at least one origin.");
  }

  for (const origin of origins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin) {
      throw new Error(`R2_CORS_ALLOWED_ORIGINS must contain origins only: ${origin}`);
    }
  }

  return origins;
}

const accountId = requireEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID");
const accessKeyId = requireEnvironmentVariable("CLOUDFLARE_R2_ACCESS_KEY_ID");
const secretAccessKey = requireEnvironmentVariable("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
const bucket = requireEnvironmentVariable("CLOUDFLARE_R2_BUCKET");
const allowedOrigins = parseAllowedOrigins(
  process.env.R2_CORS_ALLOWED_ORIGINS ??
    "http://localhost:3000,https://cloutains.top,https://www.cloutains.top",
);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function main() {
  await r2.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowedOrigins,
            AllowedMethods: ["GET", "PUT"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log("CORS configured for bucket:", bucket);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
