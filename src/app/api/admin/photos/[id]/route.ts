import { supabaseAdmin } from "@/lib/supabase-admin";
import { r2Delete, r2GetKeyFromUrl } from "@/lib/r2";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";


export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const { id } = await params;

  const { data: photo } = await supabaseAdmin
    .from("photos")
    .select("url, trips(slug)")
    .eq("id", id)
    .single()
    .overrideTypes<{ url: string; trips: { slug: string } | null }>();

  if (photo?.url) {
    try {
      const key = r2GetKeyFromUrl(photo.url);
      await r2Delete(key);
    } catch {
      // if URL is old Supabase format, try deleting from Supabase storage
      const url = new URL(photo.url);
      const path = url.pathname.replace("/storage/v1/object/public/trip-photos/", "");
      await supabaseAdmin.storage.from("trip-photos").remove([path]);
    }
  }

  const { error } = await supabaseAdmin.from("photos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (photo?.trips?.slug) {
    revalidatePath(`/trip/${photo.trips.slug}`);
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
