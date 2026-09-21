import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: Request) {
  if (!(await checkAuth(request))) return NextResponse.json({ error: '未授权' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('admin_audit_log').select('id,created_at,action,target,record_id').order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: '操作记录暂不可用' }, { status: 503 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
