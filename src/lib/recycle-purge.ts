type PurgeResult = { purgedIds: string[]; failedIds: string[] };

export async function purgePhotoArchives(ids: string[], request: typeof fetch = fetch, all = false): Promise<PurgeResult> {
  const response = await request('/api/admin/recycle-bin', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(all ? { all: true } : { ids }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || '永久删除失败');
  return { purgedIds: data.purgedIds || [], failedIds: data.failedIds || [] };
}
