"use client";

import { useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import TravelImage from "@/components/TravelImage";
import TripCard from "@/components/TripCard";
import RatingBadge from "@/components/RatingBadge";
import { formatDateRange, type Trip } from "@/lib/types";
import { CENTER_COVER, SUMMARY_MAX_LENGTH, coverObjectPosition, dragCoverPosition, type CoverPosition, type TripPresentation } from "@/lib/trip-presentation";

type PositionField = "cover_card_position" | "cover_hero_position";
type PreviewStyle = CSSProperties & { "--card-position": string; "--hero-position": string };

function subscribeViewport(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
const getViewport = () => `${document.documentElement.clientWidth},${window.innerHeight}`;
const getServerViewport = () => "1440,900";

// Scale the live hero's padding and type together with its viewport, rather than reflowing a miniature.
function heroCopyStyle(width: number, height: number): CSSProperties {
  const scale = 100 / width;
  const side = (Math.max(0, (width - 1100) / 2) + (width >= 768 ? 48 : 24)) * scale;
  return {
    left: `${side}%`, right: `${side}%`, bottom: `${(width >= 768 ? 128 : 112) / height * 100}%`,
    "--preview-title-size": `${Math.min(72, Math.max(40, width * .055)) * scale}cqw`,
    "--preview-location-size": `${(width >= 640 ? 14 : 13) * scale}cqw`,
    "--preview-date-size": `${13 * scale}cqw`,
    "--preview-location-gap": `${20 * scale}cqw`,
    "--preview-details-gap": `${28 * scale}cqw`,
    "--preview-rating-size": `${12 * scale}cqw`,
    "--preview-rating-padding": `${4 * scale}cqw ${12 * scale}cqw`,
    "--preview-column-gap": `${24 * scale}cqw`,
    "--preview-row-gap": `${16 * scale}cqw`,
  } as CSSProperties;
}

function CropFrame({ source, position, label, positionVariable, onChange, onPreview, children, className = "", style, disabled = false }: {
  source: string; position?: CoverPosition | null; label: string;
  positionVariable: "--card-position" | "--hero-position";
  onChange: (position: CoverPosition) => void;
  onPreview: (position: CoverPosition) => void;
  children?: React.ReactNode; className?: string; style?: CSSProperties; disabled?: boolean;
}) {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const drag = useRef<{
    id: number; pointer: CoverPosition; start: CoverPosition; current: CoverPosition;
    frame: { width: number; height: number }; image: { width: number; height: number };
  } | null>(null);

  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    drag.current = null;
    if (cancelled || disabled) onPreview(active.start);
    else onChange(active.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <div role="group" aria-label={label} tabIndex={disabled ? -1 : 0} aria-disabled={disabled} className={`cover-crop-frame ${className}`} style={style}
    aria-describedby="cover-crop-help"
    onKeyDown={event => {
      if (disabled || !imageSize || failed) return;
      const shifts: Record<string, CoverPosition> = {
        ArrowLeft: { x: 5, y: 0 }, ArrowRight: { x: -5, y: 0 }, ArrowUp: { x: 0, y: 5 }, ArrowDown: { x: 0, y: -5 },
      };
      const shift = shifts[event.key];
      if (!shift) return;
      event.preventDefault();
      const value = position || CENTER_COVER;
      onChange({ x: Math.max(0, Math.min(100, value.x + shift.x)), y: Math.max(0, Math.min(100, value.y + shift.y)) });
    }}
    onPointerDown={event => {
      if (disabled || event.button !== 0 || !imageSize || failed || (event.target as HTMLElement).closest("button")) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const start = position || CENTER_COVER;
      drag.current = { id: event.pointerId, pointer: { x: event.clientX, y: event.clientY }, start, current: start,
        frame: { width: rect.width, height: rect.height }, image: imageSize };
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const active = drag.current;
      if (disabled || !active || active.id !== event.pointerId) return;
      active.current = dragCoverPosition(active.start, { x: event.clientX - active.pointer.x, y: event.clientY - active.pointer.y }, active.frame, active.image);
      // Update the previews directly during a drag; commit React state only when the gesture ends.
      onPreview(active.current);
    }}
    onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event)}>
    <TravelImage key={retry} src={source} alt="" fill sizes="(max-width: 767px) 90vw, 700px" variant="hero"
      draggable={false} className="cover-preview-image object-cover" style={{ objectPosition: `var(${positionVariable})` }}
      onLoad={event => { setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setFailed(false); }}
      onError={() => { setFailed(true); setImageSize(null); }} />
    {children}
    {failed ? <div className="cover-preview-status" role="status">
      <span>封面暂时无法加载</span>
      <button type="button" onClick={() => { setFailed(false); setRetry(count => count + 1); }}>重新加载</button>
    </div> : !imageSize && <span className="cover-preview-status" role="status">正在加载封面…</span>}
  </div>;
}

function CropControls({ label, value, onChange }: { label: string; value?: CoverPosition | null; onChange: (position: CoverPosition | null) => void }) {
  const point = value || CENTER_COVER;
  function move(x: number, y: number) {
    onChange({ x: Math.max(0, Math.min(100, point.x + x)), y: Math.max(0, Math.min(100, point.y + y)) });
  }
  return <div className="cover-crop-controls" role="group" aria-label={`${label}调整按钮`}>
    <button type="button" aria-label={`${label}向左移动照片`} onClick={() => move(5, 0)}>向左</button>
    <button type="button" aria-label={`${label}向右移动照片`} onClick={() => move(-5, 0)}>向右</button>
    <button type="button" aria-label={`${label}向上移动照片`} onClick={() => move(0, 5)}>向上</button>
    <button type="button" aria-label={`${label}向下移动照片`} onClick={() => move(0, -5)}>向下</button>
    <button type="button" onClick={() => onChange(null)}>恢复居中</button>
  </div>;
}

export default function TripPresentationEditor({ trip, photoCount, onChange, disabled = false }: {
  trip: Partial<Trip>; photoCount: number; onChange: (patch: Partial<TripPresentation>) => void; disabled?: boolean;
}) {
  const previewRoot = useRef<HTMLDivElement>(null);
  const summary = trip.summary || "";
  const length = Array.from(summary.replace(/\s+/g, " ").trim()).length;
  const previewTrip = { ...trip, title: trip.title || "游记标题", date: trip.date || "", rating: trip.rating || 3 } as Trip;
  const previewStyle: PreviewStyle = { "--card-position": coverObjectPosition(trip.cover_card_position), "--hero-position": coverObjectPosition(trip.cover_hero_position) };
  const [width, height] = useSyncExternalStore(subscribeViewport, getViewport, getServerViewport).split(",").map(Number);
  const desktop = width >= 768 ? { width, height } : { width: 1440, height: 900 };
  const mobile = width < 768 ? { width, height } : { width: 390, height: 844 };
  function preview(field: PositionField, point: CoverPosition) {
    previewRoot.current?.style.setProperty(field === "cover_card_position" ? "--card-position" : "--hero-position", coverObjectPosition(point));
  }
  function commit(field: PositionField, point: CoverPosition | null) {
    preview(field, point || CENTER_COVER);
    onChange({ [field]: point });
  }
  function heroCopy(size: { width: number; height: number }) {
    return <div className="cover-hero-copy" style={heroCopyStyle(size.width, size.height)}>
      {trip.location && <p>{trip.location}</p>}
      <p className="cover-hero-preview-title">{previewTrip.title}</p>
      <div className="cover-hero-preview-details">
        {trip.date && <span>{formatDateRange(trip.date, trip.end_date).replace(" → ", " — ")}</span>}
        <RatingBadge rating={previewTrip.rating} />
      </div>
    </div>;
  }

  return <section className="trip-presentation-editor" aria-label="首页摘要与封面取景">
    <div className="flex items-baseline justify-between gap-4 mb-2">
      <label htmlFor="trip-summary" className="text-sm text-ink">首页摘要（可选）</label>
      <span id="trip-summary-count" className={`text-xs tabular-nums ${length > SUMMARY_MAX_LENGTH ? "text-red-700 dark:text-red-300" : "text-muted"}`}>{length} / {SUMMARY_MAX_LENGTH} 字</span>
    </div>
    <textarea id="trip-summary" value={summary} rows={3}
      aria-describedby="trip-summary-help trip-summary-count" aria-invalid={length > SUMMARY_MAX_LENGTH}
      onChange={event => onChange({ summary: event.target.value })}
      placeholder="写一句你最想让读者知道的旅行感受"
      className="w-full rounded-lg border border-hairline bg-canvas px-4 py-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-primary" />
    <p id="trip-summary-help" className="mt-2 text-xs leading-relaxed text-muted">建议 40 到 80 个字，最多 120 个字。留空时使用正文开头，正文内容保持原样。</p>
    {length > SUMMARY_MAX_LENGTH && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">请将摘要缩短到 120 个字以内再保存。</p>}

    <div ref={previewRoot} style={previewStyle} className="cover-editor-previews">
      <div>
        <h3 className="cover-preview-heading">首页卡片预览</h3>
        <div className="cover-card-preview home-journal">
          <TripCard trip={previewTrip} photoCount={photoCount} preview media={trip.cover_image ?
            <CropFrame key={`card-${trip.cover_image}`} source={trip.cover_image} label="首页封面取景" position={trip.cover_card_position} positionVariable="--card-position" disabled={disabled}
              onChange={point => commit("cover_card_position", point)} onPreview={point => preview("cover_card_position", point)} /> : undefined} />
        </div>
        {trip.cover_image && <CropControls label="首页封面" value={trip.cover_card_position} onChange={point => commit("cover_card_position", point)} />}
      </div>
      {trip.cover_image ? <>
        <p id="cover-crop-help" className="cover-crop-help">拖动照片调整取景，也可使用方向按钮或聚焦图片后按方向键。首页和详情页分别保存，手机预览跟随详情页取景。</p>
        <div>
          <h3 className="cover-preview-heading">详情页封面预览 <span className="text-xs text-muted">{desktop.width} × {desktop.height}</span></h3>
          <CropFrame key={`hero-${trip.cover_image}`} source={trip.cover_image} label="详情页封面取景" position={trip.cover_hero_position} positionVariable="--hero-position" className="cover-desktop-preview" disabled={disabled}
            style={{ aspectRatio: `${desktop.width} / ${desktop.height}` }}
            onChange={point => commit("cover_hero_position", point)} onPreview={point => preview("cover_hero_position", point)}>
            <div className="cover-hero-shade" aria-hidden="true" />{heroCopy(desktop)}
          </CropFrame>
          <CropControls label="详情页封面" value={trip.cover_hero_position} onChange={point => commit("cover_hero_position", point)} />
        </div>
        <details className="cover-mobile-disclosure">
          <summary>检查手机封面</summary>
          <div className="cover-mobile-preview relative overflow-hidden" style={{ aspectRatio: `${mobile.width} / ${mobile.height}` }}>
            <TravelImage src={trip.cover_image} alt="手机封面预览" fill sizes="320px" variant="hero" className="object-cover" style={{ objectPosition: "var(--hero-position)" }} />
            <div className="cover-hero-shade" aria-hidden="true" />{heroCopy(mobile)}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">{mobile.width} × {mobile.height}，使用详情页的同一取景位置，窄屏会裁切更多画面。</p>
        </details>
      </> : <p className="cover-crop-help">从旅程照片中选择封面，或填写上方封面图片地址，即可预览和调整取景。</p>}
    </div>
  </section>;
}
