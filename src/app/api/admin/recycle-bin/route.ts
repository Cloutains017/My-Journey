import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { checkAuth } from '@/lib/admin-auth';
import { UUID } from '@/lib/admin-security';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: '未授权' }, { status: 401 });
  const page = Math.max(0, Number(new URL(request.url).searchParams.get('page')) || 0);
  if (!Number.isSafeInteger(page)) return NextResponse.json({ error: '无效页码' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('admin_recycle_bin')
    .select('id,target,label,created_at').is('restored_at', null).order('created_at', { ascending: false }).order('id').range(page * 50, page * 50 + 49);
  if (error) return NextResponse.json({ error: '回收站暂不可用' }, { status: 503 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: '未授权或请求来源无效' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string' || !UUID.test(body.id)) return NextResponse.json({ error: '无效记录' }, { status: 400 });
  const { error } = await supabaseAdmin.rpc('admin_restore', { archive_id: body.id });
  if (error) return NextResponse.json({ error: '恢复失败：记录可能已恢复、存在冲突，或所属旅程尚未恢复。现有数据未被覆盖。' }, { status: 409 });
  revalidatePath('/', 'layout');
  return NextResponse.json({ success: true });
}
