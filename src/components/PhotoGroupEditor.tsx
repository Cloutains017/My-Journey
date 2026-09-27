"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Photo } from "@/lib/types";
import type { PhotoGroup } from "@/lib/photo-groups";

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

  return (
    <div className="mb-5 rounded-xl border border-hairline bg-surface-soft p-4" aria-label="照片分组管理">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-ink">分组管理</h4>
          <p className="text-xs text-muted">在下方照片卡片中调整分组，也可勾选多张批量分组。</p>
        </div>
        <button type="button" onClick={() => {
          onChange(current => [...current, { id: crypto.randomUUID(), title: `第 ${current.length + 1} 组`, photoIds: [] }]);
        }} className="px-3 py-2 rounded-lg border border-hairline bg-canvas text-sm text-ink hover:border-primary">新建分组</button>
      </div>
      {groups.length === 0 ? <p className="text-xs text-muted">暂无分组，照片会按原顺序显示。</p> : (
        <div className="space-y-2">
          {groups.map((group, index) => (
            <div key={group.id} className="rounded-lg border border-hairline bg-canvas p-3">
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
        </div>
      )}
    </div>
  );
}
