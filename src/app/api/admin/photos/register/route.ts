import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";


export async function POST(request: Request) {
  if (!(await checkAuth())) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const { tripId, urls } = await request.json();
  if (!tripId || !urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("slug")
    .eq("id", tripId)
    .single();

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
