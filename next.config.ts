import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Serve R2's pre-generated variants and originals without invoking
    // Vercel image transformations for each displayed size.
    unoptimized: true,
    remotePatterns: [
      ...(process.env.CLOUDFLARE_R2_PUBLIC_URL
        ? [new URL(`${process.env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, "")}/**`)]
        : []),
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL
        ? [new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/trip-photos/**`)]
        : []),
    ],
  },
  env: {
    // Public asset prefixes only; no credentials are exposed to the browser.
    NEXT_PUBLIC_PHOTO_BASE_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL || "",
  },
};

export default nextConfig;
