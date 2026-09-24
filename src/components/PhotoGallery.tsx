"use client";

import { useState, useEffect, useCallback } from "react";
import type { Photo } from "@/lib/types";
import TravelImage from "@/components/TravelImage";

export default function PhotoGallery({ photos, title = "旅途影像" }: { photos: Photo[]; title?: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i !== null && photos.length > 0 ? (i + 1) % photos.length : null));
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => (i !== null && photos.length > 0 ? ((i % photos.length) - 1 + photos.length) % photos.length : null));
  }, [photos.length]);

  const close = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex === null || photos.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, photos.length, goNext, goPrev, close]);

  if (photos.length === 0) return null;

  const activeIndex = lightboxIndex === null ? null : lightboxIndex % photos.length;
  const activePhoto = activeIndex === null ? null : photos[activeIndex];

  return (
    <div className="mb-12">
      <p className="text-xs uppercase tracking-[3px] text-muted-soft mb-5 font-medium font-sans">
        {title} · {photos.length} Photos
      </p>
      <div className="columns-2 md:columns-3 gap-3">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            aria-label={`查看第 ${i + 1} 张照片${photo.caption ? `：${photo.caption}` : ""}`}
            onClick={() => setLightboxIndex(i)}
            className="relative block mb-3 rounded-lg overflow-hidden bg-surface-cream-strong hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer break-inside-avoid group"
          >
            <TravelImage
              src={photo.url}
              alt={photo.caption || ""}
              width={photo.width || 1200}
              height={photo.height || 800}
              sizes="(max-width: 767px) calc((100vw - 76px) / 2), 227px"
              className="w-full h-auto object-cover hover:scale-[1.02] transition-transform duration-500"
              loading="lazy"
            />
            {photo.caption && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <span className="text-white text-xs font-sans">{photo.caption}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {activePhoto && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer animate-fade-in"
          onClick={close}
        >
          <TravelImage
            src={activePhoto.url}
            alt={activePhoto.caption || "旅途照片"}
            width={activePhoto.width || 1200}
            height={activePhoto.height || 800}
            unoptimized
            style={{ width: "auto", height: "auto" }}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Close */}
          <button
            className="absolute top-6 right-6 text-white/60 hover:text-white text-2xl transition-colors"
            onClick={close}
            aria-label="关闭"
          >
            ✕
          </button>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/10"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              aria-label="上一张"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Next */}
          {photos.length > 1 && (
            <button
              className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/10"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              aria-label="下一张"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Counter */}
          {photos.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm font-sans">
              {(activeIndex ?? 0) + 1} / {photos.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
