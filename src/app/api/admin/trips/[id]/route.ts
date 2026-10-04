import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { archiveDelete } from "@/lib/admin-recycle";
import { validatePhotoGroups } from "@/lib/photo-groups";
import { validateTripPresentation } from "@/lib/trip-presentation";


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
  if (!(await checkAuth(request))) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  let presentation;
  try {
    presentation = validateTripPresentation(body);
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "摘要或封面取景无效" }, { status: 400 });
  }
  const { title, slug: customSlug, date, end_date, location, city_name, latitude, longitude, cover_image, content, rating } = body;
  if (Object.hasOwn(body, "cover_image") &&
    (!Object.hasOwn(body, "cover_card_position") || !Object.hasOwn(body, "cover_hero_position"))) {
    const { data: previous, error: previousError } = await supabaseAdmin.from("trips").select("cover_image").eq("id", id).maybeSingle();
    if (previousError) return NextResponse.json({ error: "读取封面失败" }, { status: 500 });
    if (!previous) return NextResponse.json({ error: "旅程不存在" }, { status: 404 });
    if ((cover_image || null) !== previous.cover_image) {
      if (!Object.hasOwn(body, "cover_card_position")) presentation.cover_card_position = null;
      if (!Object.hasOwn(body, "cover_hero_position")) presentation.cover_hero_position = null;
    }
  }
  let photoGroups;
  if (Object.prototype.hasOwnProperty.call(body, "photo_groups")) {
    const { data: photos, error: photosError } = await supabaseAdmin.from("photos").select("id").eq("trip_id", id);
    if (photosError) return NextResponse.json({ error: "读取照片失败" }, { status: 500 });
    try {
      photoGroups = validatePhotoGroups(body.photo_groups, new Set((photos || []).map(photo => photo.id)));
    } catch (reason) {
      return NextResponse.json({ error: reason instanceof Error ? reason.message : "照片分组格式无效" }, { status: 400 });
    }
  }
  const slug = customSlug || generateSlug(title || "", date);
  const { error } = await supabaseAdmin.from("trips").update({
    title, slug, date, end_date: end_date || null, location, city_name: city_name || null, latitude, longitude, cover_image: cover_image || null, content, rating,
    ...(photoGroups === undefined ? {} : { photo_groups: photoGroups }),
    ...presentation,
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
  return archiveDelete(request, "trips", (await params).id);
}
