import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";


export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const { id } = await params;

  const { data: vote } = await supabaseAdmin
    .from("agreement_votes")
    .select("trip_id, trips(slug)")
    .eq("id", id)
    .single()
    .overrideTypes<{ trip_id: string; trips: { slug: string } | null }>();

  const { error } = await supabaseAdmin.from("agreement_votes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (vote?.trips?.slug) {
    revalidatePath(`/trip/${vote.trips.slug}`);
  }

  return NextResponse.json({ success: true });
}
