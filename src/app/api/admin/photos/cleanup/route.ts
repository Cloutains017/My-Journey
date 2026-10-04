import { NextResponse } from 'next/server';
import { adminSessionConfig, checkAuth } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { r2Delete } from '@/lib/r2';
import { photoDeletionKeys } from '@/lib/photo-variants';
import { loadStorageReferences } from '@/lib/storage-references';
import { cleanupFailedUpload, verifyUploadCleanupToken } from '@/lib/upload-cleanup';

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!await checkAuth(request)) return NextResponse.json({ error: '未授权' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const receipt = verifyUploadCleanupToken(body?.cleanupToken, adminSessionConfig());
  if (!receipt || typeof body?.registrationAttempted !== 'boolean') return NextResponse.json({ error: '上传清理凭证无效，请到存储检查核对', code: 'invalid_cleanup_receipt' }, { status: 400 });
  try {
    const { references } = await loadStorageReferences(supabaseAdmin, process.env.CLOUDFLARE_R2_PUBLIC_URL || '', photoDeletionKeys(receipt.key), true);
    const result = await cleanupFailedUpload(receipt, body.registrationAttempted, new Set([...references.live, ...references.recycled]), r2Delete);
    return NextResponse.json(result, { status: result.status === 'deferred' ? 202 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '无法确认文件引用或清理未完成，将在后台重试' }, { status: 503 });
  }
}
