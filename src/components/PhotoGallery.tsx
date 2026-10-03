"use client";

import { useState } from "react";
import type { Photo } from "@/lib/types";
import TravelImage from "@/components/TravelImage";
import PhotoLightbox from "@/components/PhotoLightbox";

export default function PhotoGallery({ photos, title = "旅途影像" }: { photos: Photo[]; title?: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

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
              className="w-full h-auto object-cover motion-safe:group-hover:scale-[1.02] transition-transform duration-500"
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

      {lightboxIndex !== null && <PhotoLightbox photos={photos} initialIndex={lightboxIndex} title={title} onClose={() => setLightboxIndex(null)} />}
    </div>
  );
}
