"use client";

import type { Dispatch, SetStateAction } from "react";
import TravelImage from "@/components/TravelImage";
import type { Photo } from "@/lib/types";
import { assignPhotosToGroup, type PhotoGroup } from "@/lib/photo-groups";

interface Props {
  photos: Photo[];
  groups: PhotoGroup[];
  onChange: Dispatch<SetStateAction<PhotoGroup[]>>;
}

export default function PhotoGroupEditor({ photos, groups, onChange }: Props) {
  function moveGroup(index: number, direction: -1 | 1) {
    const next = [...groups];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  }

  function assignPhoto(photoId: string, groupId: string) {
    onChange(current => assignPhotosToGroup(current, [photoId], groupId));
  }

  return (
    <section className="mt-8 border-t border-hairline pt-6" aria-label="照片分组">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h4 className="text-base font-semibold text-ink">照片分组</h4>
        <button type="button" onClick={() => {
          onChange(current => [...current, { id: crypto.randomUUID(), title: `第 ${current.length + 1} 组`, photoIds: [] }]);
        }} className="px-3 py-2 rounded-lg border border-hairline text-sm text-ink hover:border-primary">+ 新建分组</button>
      </div>
      <p className="text-xs text-muted mb-5">可在上方勾选多张照片批量分组，也可在这里逐张调整。未分组照片显示在最后。</p>

      {groups.map((group, index) => (
        <div key={group.id} className="mb-3 rounded-xl border border-hairline bg-surface-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`group-${group.id}`}>第 {index + 1} 组名称</label>
            <input id={`group-${group.id}`} value={group.title} maxLength={80}
              onChange={event => {
                const title = event.target.value;
                onChange(current => current.map(item => item.id === group.id ? { ...item, title } : item));
              }}
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm text-ink" />
            <button type="button" disabled={index === 0} onClick={() => moveGroup(index, -1)} aria-label={`上移${group.title}`} className="px-2 py-1 text-sm text-muted disabled:opacity-30">↑</button>
            <button type="button" disabled={index === groups.length - 1} onClick={() => moveGroup(index, 1)} aria-label={`下移${group.title}`} className="px-2 py-1 text-sm text-muted disabled:opacity-30">↓</button>
            <button type="button" onClick={() => onChange(current => current.filter(item => item.id !== group.id))} className="px-2 py-1 text-xs text-red-500">删除组</button>
          </div>
          <p className="mt-2 text-xs text-muted">{group.photoIds.filter(id => photos.some(photo => photo.id === id)).length} 张照片</p>
        </div>
      ))}

      {photos.length > 0 && groups.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className="overflow-hidden rounded-lg border border-hairline bg-surface-card">
              <TravelImage src={photo.url} alt={photo.caption || `照片 ${index + 1}`} width={240} height={160} className="h-24 w-full object-cover" />
              <label className="block p-2 text-xs text-muted">
                照片 {index + 1} 的分组
                <select value={groups.find(group => group.photoIds.includes(photo.id))?.id || ""}
                  onChange={event => assignPhoto(photo.id, event.target.value)}
                  className="mt-1 w-full rounded border border-hairline bg-canvas p-1.5 text-xs text-ink">
                  <option value="">未分组</option>
                  {groups.map(group => <option key={group.id} value={group.id}>{group.title}</option>)}
                </select>
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
