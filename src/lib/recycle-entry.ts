export type RecyclePreview = {
  url: string;
  caption: string | null;
  width: number | null;
  height: number | null;
};

type ArchiveRow = {
  id: string;
  target: string;
  label: string;
  created_at: string;
  payload?: unknown;
};

export type RecycleEntry = Omit<ArchiveRow, "payload"> & { preview?: RecyclePreview };

export function toRecycleEntry(row: ArchiveRow): RecycleEntry {
  const { payload: rawPayload, ...entry } = row;
  if (row.target !== "photos" || !rawPayload || typeof rawPayload !== "object") return entry;

  const photos = (rawPayload as { photos?: unknown }).photos;
  if (!Array.isArray(photos) || !photos[0] || typeof photos[0] !== "object") return entry;
  const photo = photos[0] as Record<string, unknown>;
  if (typeof photo.url !== "string" || !photo.url) return entry;

  return {
    ...entry,
    preview: {
      url: photo.url,
      caption: typeof photo.caption === "string" && photo.caption ? photo.caption : null,
      width: typeof photo.width === "number" ? photo.width : null,
      height: typeof photo.height === "number" ? photo.height : null,
    },
  };
}
