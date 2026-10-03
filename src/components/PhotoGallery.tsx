"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Photo } from "@/lib/types";
import TravelImage from "@/components/TravelImage";
const PhotoLightbox = dynamic(() => import("@/components/PhotoLightbox"), {
  loading: () => <p role="status" className="mt-3 text-sm text-muted">正在打开照片…</p>,
});

export default function PhotoGallery({ photos, title = "旅途影像" }: { photos: Photo[]; title?: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <div className="mb-12">
      <p className="text-xs uppercase tracking-[3px] text-muted-soft mb-5 font-medium font-sans">
        {title} · {photos.length} Photos
      </p>
      <div className="photo-gallery-grid columns-2 md:columns-3">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            aria-label={`查看第 ${i + 1} 张照片${photo.caption ? `：${photo.caption}` : ""}`}
            onClick={() => setLightboxIndex(i)}
            className="photo-gallery-tile relative block w-full rounded-lg overflow-hidden bg-surface-cream-strong hover:ring-2 hover:ring-primary/30 cursor-pointer break-inside-avoid group"
            style={{ aspectRatio: `${photo.width && photo.width > 0 ? photo.width : 1200} / ${photo.height && photo.height > 0 ? photo.height : 800}` }}
          >
            <TravelImage
              src={photo.url}
              alt={photo.caption || ""}
              fill
              sizes="(max-width: 639px) calc((100vw - 50px) / 2), (max-width: 767px) calc((100vw - 76px) / 2), 227px"
              className="object-cover motion-safe:group-hover:scale-[1.02] transition-[opacity,transform] duration-500"
              loading="lazy"
              fetchPriority="low"
            />
            {photo.caption && (
              <div className="photo-gallery-caption absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-end p-2.5 sm:p-3">
                <span className="text-white text-xs leading-relaxed line-clamp-2 font-sans">{photo.caption}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {lightboxIndex !== null && <PhotoLightbox photos={photos} initialIndex={lightboxIndex} title={title} onClose={() => setLightboxIndex(null)} />}
    </div>
  );
}
