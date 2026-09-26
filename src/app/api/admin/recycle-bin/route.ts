import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { checkAuth } from '@/lib/admin-auth';
import { UUID } from '@/lib/admin-security';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { r2Delete, r2KeyFromPublicUrl } from '@/lib/r2';
import { photoDeletionKeys } from '@/lib/photo-variants';
import { toRecycleEntry } from '@/lib/recycle-entry';

type RecycledPhoto = { id: string; payload: { photos?: { url?: string }[] } };

async function photoArchives(ids: string[]) {
  const { data, error } = await supabaseAdmin.from('admin_recycle_bin')
    .select('id,payload').in('id', ids).eq('target', 'photos').is('restored_at', null);
  if (error) throw new Error('回收站暂不可用');
  if ((data || []).length !== ids.length) throw new Error('部分照片已恢复或不存在，请刷新列表后重试');
  return data as RecycledPhoto[];
}

async function allPhotoArchiveIds() {
  const ids: string[] = [];
  let start = 0;
  while (true) {
    const { data, error } = await supabaseAdmin.from('admin_recycle_bin')
      .select('id').eq('target', 'photos').is('restored_at', null).order('created_at').order('id').range(start, start + 99);
    if (error) throw new Error('回收站暂不可用');
    if (!data?.length) return ids;
    ids.push(...data.map(row => row.id));
    if (data.length < 100) return ids;
    start += data.length;
  }
}

export async function GET(request: Request) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: '未授权' }, { status: 401 });
  const page = Math.max(0, Number(new URL(request.url).searchParams.get('page')) || 0);
  if (!Number.isSafeInteger(page)) return NextResponse.json({ error: '无效页码' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('admin_recycle_bin')
    .select('id,target,label,created_at,payload').is('restored_at', null).order('created_at', { ascending: false }).order('id').range(page * 50, page * 50 + 49);
  if (error) return NextResponse.json({ error: '回收站暂不可用' }, { status: 503 });
  return NextResponse.json((data || []).map(toRecycleEntry), { headers: { 'Cache-Control': 'no-store' } });
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

export async function DELETE(request: Request) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: '未授权或请求来源无效' }, { status: 401 });
  const body = await request.json().catch(() => null);
  try {
    const all = body?.all === true;
    const requestedIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
    if (!all && (!requestedIds.length || requestedIds.length > 100 || requestedIds.some(id => typeof id !== 'string' || !UUID.test(id)))) {
      return NextResponse.json({ error: '请选择最多 100 张有效照片' }, { status: 400 });
    }
    const ids = all ? await allPhotoArchiveIds() : [...new Set(requestedIds as string[])];
    if (!ids.length) return NextResponse.json({ success: true, purgedIds: [], failedIds: [] });
    const archives = await photoArchives(ids);
    const purgedIds: string[] = [];
    const failedIds: string[] = [];
    for (const archive of archives) {
      const url = archive.payload.photos?.[0]?.url;
      try {
        if (!url) throw new Error('照片快照缺少原图地址');
        for (const key of photoDeletionKeys(r2KeyFromPublicUrl(url))) await r2Delete(key);
        const { error } = await supabaseAdmin.rpc('admin_purge_archive', { archive_id: archive.id });
        if (error) throw new Error('照片原图已删除，但回收站记录尚未确认清除。请勿恢复这条记录，并联系管理员。');
        purgedIds.push(archive.id);
      } catch {
        failedIds.push(archive.id);
      }
    }
    revalidatePath('/', 'layout');
    return NextResponse.json({ success: failedIds.length === 0, purgedIds, failedIds });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '永久删除失败' }, { status: 409 });
  }
}
