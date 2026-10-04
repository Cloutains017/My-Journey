"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Photo } from "@/lib/types";
import TravelImage from "@/components/TravelImage";
const PhotoLightbox = dynamic(() => import("@/components/PhotoLightbox"), {
  loading: () => <p role="status" className="mt-3 text-sm text-muted">正在打开照片…</p>,
});

const BATCH_SIZE = 24;

export default function PhotoGallery({ photos, title = "旅途影像", id }: { photos: Photo[]; title?: string; id?: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const newBatchRef = useRef<HTMLButtonElement>(null);
  const shown = Math.min(visibleCount, photos.length);
  const newBatchStart = Math.floor((shown - 1) / BATCH_SIZE) * BATCH_SIZE;
  const gridId = id ? `${id}-grid` : undefined;

  useEffect(() => {
    if (visibleCount > BATCH_SIZE) newBatchRef.current?.focus();
  }, [visibleCount, photos.length]);

  if (photos.length === 0) return null;

  return (
    <section id={id} tabIndex={-1} aria-label={`${title}照片`} className="photo-gallery mb-12">
      <h2 className="photo-gallery-heading">
        <span>{title}</span>
        <span className="photo-gallery-count">{photos.length} 张照片</span>
      </h2>
      <div id={gridId}>
        {Array.from({ length: Math.ceil(shown / BATCH_SIZE) }, (_, batch) => (
          <div key={photos[batch * BATCH_SIZE].id} className="photo-gallery-grid photo-gallery-batch columns-2 md:columns-3">
            {photos.slice(batch * BATCH_SIZE, Math.min((batch + 1) * BATCH_SIZE, shown)).map((photo, offset) => {
              const i = batch * BATCH_SIZE + offset;
              return (
                <button
                  key={photo.id}
                  ref={i === newBatchStart ? newBatchRef : undefined}
                  type="button"
                  aria-label={`查看第 ${i + 1} 张照片${photo.caption ? `：${photo.caption}` : ""}`}
                  onClick={() => setLightboxIndex(i)}
                  className="photo-gallery-tile relative block w-full rounded-lg overflow-hidden bg-surface-cream-strong hover:ring-2 hover:ring-primary/30 cursor-pointer break-inside-avoid group"
                >
                  <TravelImage
                    src={photo.url}
                    alt={photo.caption || ""}
                    width={photo.width && photo.width > 0 ? photo.width : 1200}
                    height={photo.height && photo.height > 0 ? photo.height : 800}
                    sizes="(max-width: 639px) calc((100vw - 50px) / 2), (max-width: 767px) calc((100vw - 76px) / 2), 227px"
                    className="block h-auto w-full object-contain transition-opacity duration-300"
                    loading="lazy"
                    fetchPriority="low"
                  />
                  {photo.caption && (
                    <div className="photo-gallery-caption absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-end p-2.5 sm:p-3">
                      <span className="text-white text-xs leading-relaxed line-clamp-2 font-sans">{photo.caption}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {photos.length > BATCH_SIZE && <div className="photo-gallery-footer">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-muted">
          已显示 {shown} / {photos.length} 张照片
        </p>
        {shown < photos.length && <button type="button" aria-controls={gridId} className="photo-gallery-more"
          onClick={() => setVisibleCount(count => Math.min(count + BATCH_SIZE, photos.length))}>
          再显示 {Math.min(BATCH_SIZE, photos.length - shown)} 张照片 <span aria-hidden="true">↓</span>
        </button>}
      </div>}

      {lightboxIndex !== null && <PhotoLightbox photos={photos} initialIndex={lightboxIndex} title={title} onClose={() => setLightboxIndex(null)} />}
    </section>
  );
}
