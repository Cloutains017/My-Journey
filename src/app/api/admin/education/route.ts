import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { validateEducation } from "@/lib/education";

export async function GET(request: Request) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("education").select("*").order("date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: "未授权" }, { status: 401 });
  let values;
  try { values = validateEducation(await request.json()); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const { data, error } = await supabaseAdmin.from("education").insert(values).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/");
  revalidatePath("/map");
  return NextResponse.json(data);
}
