import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkAuth } from "@/lib/admin-auth";
import { UUID } from "@/lib/admin-security";
import { validatePhotoGroups } from "@/lib/photo-groups";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "无效的旅程" }, { status: 400 });

  const { data: trip, error: tripError } = await supabaseAdmin.from("trips").select("slug").eq("id", id).maybeSingle();
  if (tripError) return NextResponse.json({ error: "读取旅程失败" }, { status: 500 });
  if (!trip) return NextResponse.json({ error: "旅程不存在" }, { status: 404 });

  const { data: photos, error: photosError } = await supabaseAdmin.from("photos").select("id").eq("trip_id", id);
  if (photosError) return NextResponse.json({ error: "读取照片失败" }, { status: 500 });

  let groups;
  try {
    const body = await request.json();
    groups = validatePhotoGroups(body?.groups, new Set((photos || []).map(photo => photo.id)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "照片分组格式无效" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("trips").update({ photo_groups: groups }).eq("id", id);
  if (error) return NextResponse.json({ error: "保存分组失败" }, { status: 500 });
  revalidatePath(`/trip/${trip.slug}`);
  return NextResponse.json({ groups });
}
