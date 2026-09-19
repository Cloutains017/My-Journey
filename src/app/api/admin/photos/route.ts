import { supabaseAdmin } from "@/lib/supabase-admin";
import { r2Upload } from "@/lib/r2";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";


export async function POST(request: Request) {
  if (!(await checkAuth())) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const formData = await request.formData();
  const tripId = formData.get("tripId") as string;
  const files = formData.getAll("files") as File[];

  if (!tripId || files.length === 0) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

  const { data: trip } = await supabaseAdmin.from("trips").select("slug").eq("id", tripId).single();

  const results = [];

  for (const file of files) {
    const key = `${tripId}/${Date.now()}-${file.name}`;
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
