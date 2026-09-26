import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { registeredPhotoKey, createPhotoKey, PHOTO_MAX_BYTES, UUID } from "@/lib/admin-security";
import { r2PhotoInfo } from "@/lib/r2";
import { photoVariantKey } from "@/lib/photo-variants";


export async function POST(request: Request) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const { tripId, urls } = (await request.json().catch(() => null)) || {};
  if (typeof tripId !== "string" || !UUID.test(tripId) || !Array.isArray(urls) || urls.length === 0 || urls.length > 100) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

  try {
    for (const url of urls) {
      const key = registeredPhotoKey(url, tripId, process.env.CLOUDFLARE_R2_PUBLIC_URL || "");
      const info = await r2PhotoInfo(key);
      createPhotoKey(tripId, info.ContentType);
      if (!info.ContentLength || info.ContentLength > PHOTO_MAX_BYTES) throw new Error("Invalid size");
      for (const variant of ["thumb", "hero"] as const) {
        const variantInfo = await r2PhotoInfo(photoVariantKey(key, variant));
        if (variantInfo.ContentType !== "image/webp" || !variantInfo.ContentLength || variantInfo.ContentLength > 10 * 1024 * 1024) {
          throw new Error("Invalid photo variant");
        }
      }
    }
  } catch { return NextResponse.json({ error: "图片或缩略图未上传完成、类型不支持或超过大小限制" }, { status: 400 }); }

  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("slug")
    .eq("id", tripId)
    .single();
  if (!trip) return NextResponse.json({ error: "旅程不存在" }, { status: 404 });

  const rows = urls.map((url: string) => ({
    trip_id: tripId,
    url,
    caption: null,
    sort_order: 0,
  }));

  const { error } = await supabaseAdmin.from("photos").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (trip?.slug) {
    revalidatePath(`/trip/${trip.slug}`);
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
