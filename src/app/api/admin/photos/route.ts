import { supabaseAdmin } from "@/lib/supabase-admin";
import { r2Upload } from "@/lib/r2";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { createPhotoKey, PHOTO_MAX_BYTES, UUID } from "@/lib/admin-security";


export async function POST(request: Request) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const formData = await request.formData();
  const tripId = formData.get("tripId") as string;
  const files = formData.getAll("files") as File[];

  if (!UUID.test(tripId || "") || files.length === 0 || files.length > 100 || files.some(file => !(file instanceof File) || !file.size || file.size > PHOTO_MAX_BYTES)) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

  const { data: trip } = await supabaseAdmin.from("trips").select("slug").eq("id", tripId).single();
  if (!trip) return NextResponse.json({ error: "旅程不存在" }, { status: 404 });
  let keys: string[];
  try { keys = files.map(file => createPhotoKey(tripId, file.type)); }
  catch { return NextResponse.json({ error: "图片类型不支持" }, { status: 400 }); }

  const results = [];

  for (const [index, file] of files.entries()) {
    const key = keys[index];
    const bytes = await file.arrayBuffer();
    const publicUrl = await r2Upload(key, Buffer.from(bytes), file.type);

    const { error: dbError } = await supabaseAdmin.from("photos").insert({
      trip_id: tripId,
      url: publicUrl,
      caption: null,
      sort_order: 0,
    });

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    results.push(publicUrl);
  }

  if (trip?.slug) {
    revalidatePath(`/trip/${trip.slug}`);
  }

  revalidatePath("/");
  return NextResponse.json({ urls: results });
}
