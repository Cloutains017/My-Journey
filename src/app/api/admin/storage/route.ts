import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { r2ListObjects } from '@/lib/r2';
import { auditStorage } from '@/lib/storage-audit';
import { loadStorageReferences } from '@/lib/storage-references';

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!await checkAuth(request)) return NextResponse.json({ error: '未授权' }, { status: 401 });
  try {
    // Read references after the object list so completed registrations are included.
    const objects = await r2ListObjects();
    const { references, trips } = await loadStorageReferences(supabaseAdmin, process.env.CLOUDFLARE_R2_PUBLIC_URL || '', objects.map(object => object.key));
    return NextResponse.json(auditStorage(objects, references, trips), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '存储检查未完成，请稍后重试；无法确认时不会报告没有遗留文件。' }, { status: 503 });
  }
}
