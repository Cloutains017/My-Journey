import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkAuth } from "@/lib/admin-auth";
import { validateEducation } from "@/lib/education";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: "未授权" }, { status: 401 });
  let values;
  try { values = validateEducation(await request.json()); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const { data, error } = await supabaseAdmin.from("education").update(values).eq("id", (await params).id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/");
  revalidatePath("/map");
  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const { error } = await supabaseAdmin.from("education").delete().eq("id", (await params).id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/");
  revalidatePath("/map");
  return NextResponse.json({ success: true });
}
