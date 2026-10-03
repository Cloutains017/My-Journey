"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/types";
import TravelImage from "@/components/TravelImage";

function LightboxPhoto({ photo, direction, onReady }: { photo: Photo; direction: number; onReady(): void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  return (
    <figure className="lightbox-photo" data-direction={direction} onClick={event => event.stopPropagation()}>
      <div className="lightbox-image-wrap">
        <TravelImage src={photo.url} alt="" aria-hidden="true" width={photo.width || 1200} height={photo.height || 800}
          className="lightbox-preview" data-loaded={loaded} />
        <TravelImage key={attempt} src={photo.url} alt={photo.caption || "旅途照片"} width={photo.width || 1200} height={photo.height || 800}
          variant="original" loading="eager" className="lightbox-original" data-loaded={loaded}
          onLoad={() => { setLoaded(true); setFailed(false); onReady(); }} onError={() => setFailed(true)} />
        {!loaded && <div className="lightbox-image-status" role="status">
          {failed ? <><span>原图暂时无法加载</span><button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>重试</button></>
            : <><span className="lightbox-spinner" aria-hidden="true" /><span>正在加载原图</span></>}
        </div>}
      </div>
      {photo.caption && <figcaption className="lightbox-caption">{photo.caption}</figcaption>}
    </figure>
  );
}

export default function PhotoLightbox({ photos, initialIndex, title, onClose }: {
  photos: Photo[]; initialIndex: number; title: string; onClose(): void;
}) {
  const [slide, setSlide] = useState({ index: initialIndex, direction: 0 });
  const [readyId, setReadyId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const gestureRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const gestureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndex = ((slide.index % photos.length) + photos.length) % photos.length;
  const photo = photos[currentIndex];

  const move = useCallback((direction: number) => {
    if (photos.length < 2) return;
    setSlide(value => ({ index: (value.index + direction + photos.length) % photos.length, direction }));
  }, [photos.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const oldOverflow = root.style.overflow;
    const oldBodyOverflow = document.body.style.overflow;
    const oldBodyPadding = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    const bodyPadding = parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
    dialog.showModal();
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${bodyPadding + scrollbarWidth}px`;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      root.style.overflow = oldOverflow;
      document.body.style.overflow = oldBodyOverflow;
      document.body.style.paddingRight = oldBodyPadding;
      previousFocus?.focus({ preventScroll: true });
      if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
    };
  }, []);

  // Load only the immediate neighbours, after the current original is ready.
  useEffect(() => {
    if (readyId !== photo.id || photos.length < 2) return;
    const neighbours = new Set([
      photos[(currentIndex + 1) % photos.length].url,
      photos[(currentIndex - 1 + photos.length) % photos.length].url,
    ]);
    neighbours.delete(photo.url);
    neighbours.forEach(url => { const image = new window.Image(); image.src = url; });
  }, [currentIndex, photo.id, photo.url, photos, readyId]);

  return (
    <dialog ref={dialogRef} className="photo-lightbox" aria-label={`${title}，照片浏览`} onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
        if (event.key === "Tab") {
          const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex="0"]');
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}
      onClick={event => {
        if (suppressClickRef.current) return;
        if (event.target === event.currentTarget) onClose();
      }}>
      <div className="lightbox-toolbar">
        <span className="lightbox-title">{title}</span>
        <button type="button" className="lightbox-control" aria-label="关闭照片浏览" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="lightbox-stage" onClick={event => { if (event.target === event.currentTarget && !suppressClickRef.current) onClose(); }}
        onPointerDown={event => {
          if (event.pointerType === "touch" && event.isPrimary) gestureRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          else gestureRef.current = null;
        }}
        onPointerCancel={() => { gestureRef.current = null; }}
        onPointerUp={event => {
          const start = gestureRef.current;
          gestureRef.current = null;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
          suppressClickRef.current = true;
          if (gestureTimerRef.current) clearTimeout(gestureTimerRef.current);
          gestureTimerRef.current = setTimeout(() => { suppressClickRef.current = false; }, 350);
          move(dx < 0 ? 1 : -1);
        }}>
        <LightboxPhoto key={photo.id} photo={photo} direction={slide.direction} onReady={() => setReadyId(photo.id)} />
      </div>
      <div className="lightbox-navigation">
        <button type="button" className="lightbox-control" aria-label="上一张照片" disabled={photos.length < 2} onClick={() => move(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <span className="lightbox-counter" role="status" aria-live="polite" aria-atomic="true">{currentIndex + 1} / {photos.length}</span>
        <button type="button" className="lightbox-control" aria-label="下一张照片" disabled={photos.length < 2} onClick={() => move(1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
    </dialog>
  );
}
