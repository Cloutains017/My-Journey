import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";


export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const [{ data: agreements }, { data: desires }] = await Promise.all([
    supabaseAdmin.from("agreement_votes").select("*, trips(title)").order("created_at", { ascending: false }),
    supabaseAdmin.from("desire_votes").select("*, trips(title)").order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({ agreements: agreements || [], desires: desires || [] });
}
