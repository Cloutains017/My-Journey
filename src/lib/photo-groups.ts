import type { Photo } from "./types";

export interface PhotoGroup {
  id: string;
  title: string;
  photoIds: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validatePhotoGroups(input: unknown, ownedPhotoIds: Set<string>): PhotoGroup[] {
  if (!Array.isArray(input) || input.length > 50) throw new Error("照片分组格式无效或数量过多");
  const groupIds = new Set<string>();
  const assigned = new Set<string>();
  return input.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("照片分组格式无效");
    const group = value as Record<string, unknown>;
    if (typeof group.id !== "string" || !UUID.test(group.id) || groupIds.has(group.id)) throw new Error("照片分组 ID 无效或重复");
    if (typeof group.title !== "string" || !group.title.trim() || group.title.trim().length > 80) throw new Error("分组名称须为 1 至 80 个字");
    if (!Array.isArray(group.photoIds) || group.photoIds.length > 1000) throw new Error("分组照片格式无效或数量过多");
    groupIds.add(group.id);
    const photoIds = group.photoIds.map((id: unknown) => {
      if (typeof id !== "string" || !UUID.test(id)) throw new Error("照片 ID 无效");
      if (!ownedPhotoIds.has(id)) throw new Error("照片不属于当前旅程");
      if (assigned.has(id)) throw new Error("照片不能重复分组");
      assigned.add(id);
      return id;
    });
    return { id: group.id, title: group.title.trim(), photoIds };
  });
}

export function groupTripPhotos(photos: Photo[], input: PhotoGroup[] | null | undefined) {
  if (!input?.length) return photos.length ? [{ id: "all", title: "旅途影像", photos }] : [];
  const byId = new Map(photos.map(photo => [photo.id, photo]));
  const assigned = new Set<string>();
  const groups = input.map(group => {
    const groupPhotos = group.photoIds.flatMap(id => {
      const photo = byId.get(id);
      if (!photo || assigned.has(id)) return [];
      assigned.add(id);
      return [photo];
    });
    return { id: group.id, title: group.title, photos: groupPhotos };
  }).filter(group => group.photos.length > 0);
  const unassigned = photos.filter(photo => !assigned.has(photo.id));
  if (unassigned.length) groups.push({ id: "unassigned", title: "未分组", photos: unassigned });
  return groups;
}
