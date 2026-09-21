/** Keep uncertain failures visible; each request uses the existing authenticated recycle-bin API. */
export async function deletePhotos(ids: string[], request: typeof fetch = fetch) {
  const deletedIds: string[] = [];
  const failedIds: string[] = [];
  // Sequential requests avoid flooding the archive endpoint for large selections.
  for (const id of new Set(ids)) {
    try {
      const response = await request(`/api/admin/photos/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (response.ok) deletedIds.push(id);
      else failedIds.push(id);
    } catch {
      failedIds.push(id);
    }
  }
  return { deletedIds, failedIds };
}
