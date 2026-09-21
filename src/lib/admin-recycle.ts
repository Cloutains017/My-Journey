import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { checkAuth } from './admin-auth';
import { UUID } from './admin-security';
import { supabaseAdmin } from './supabase-admin';

export async function archiveDelete(request: Request, target: 'trips' | 'photos' | 'agreement_votes' | 'desire_votes', id: string) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: '未授权或请求来源无效' }, { status: 401 });
  if (!UUID.test(id)) return NextResponse.json({ error: '无效的记录' }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc('admin_archive_delete', { target_table: target, target_id: id });
  if (error) return NextResponse.json({ error: '暂未能确认操作结果，请刷新列表和回收站后再试' }, { status: 503 });
  revalidatePath('/', 'layout');
  return NextResponse.json({ success: true, archiveId: data });
}
