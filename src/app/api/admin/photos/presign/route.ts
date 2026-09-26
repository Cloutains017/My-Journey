import { r2PresignUpload } from "@/lib/r2";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";
import { createPhotoKey } from "@/lib/admin-security";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { photoVariantKey } from "@/lib/photo-variants";

const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;


export async function POST(request: Request) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const body = await request.json().catch(() => null);
  let key: string;
  try { key = createPhotoKey(body?.tripId, body?.contentType); }
  catch { return NextResponse.json({ error: "无效的旅程或图片类型" }, { status: 400 }); }
  const { tripId, contentType } = body;
  const { data: trip, error } = await supabaseAdmin.from("trips").select("id").eq("id",tripId).maybeSingle();
  if (error || !trip) return NextResponse.json({ error: "旅程不存在或暂不可用" }, { status: 404 });
  const [presignedUrl, thumbPresignedUrl, heroPresignedUrl] = await Promise.all([
    r2PresignUpload(key, contentType),
    r2PresignUpload(photoVariantKey(key, "thumb"), "image/webp"),
    r2PresignUpload(photoVariantKey(key, "hero"), "image/webp"),
  ]);
  return NextResponse.json({ presignedUrl, thumbPresignedUrl, heroPresignedUrl, key, publicUrl: `${PUBLIC_URL}/${key}` });
}
