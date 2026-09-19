import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";


function generateSlug(title: string, date?: string): string {
  const ascii = title
    .replace(/[^\x00-\x7F]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  if (ascii.length >= 2) return ascii;
  if (date) return `trip-${date}`;
  return `trip-${Date.now()}`;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const { title, slug: customSlug, date, end_date, location, city_name, latitude, longitude, cover_image, content, rating } = body;
  const slug = customSlug || generateSlug(title || "", date);
  const { error } = await supabaseAdmin.from("trips").update({
    title, slug, date, end_date: end_date || null, location, city_name: city_name || null, latitude, longitude, cover_image: cover_image || null, content, rating
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/");
  revalidatePath(`/trip/${slug}`);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const { id } = await params;

  const { data: trip } = await supabaseAdmin.from("trips").select("slug").eq("id", id).single();

  const { error } = await supabaseAdmin.from("trips").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/");
  if (trip?.slug) revalidatePath(`/trip/${trip.slug}`);
  return NextResponse.json({ success: true });
}
