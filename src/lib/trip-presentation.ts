import type { Trip } from "./types.ts";

export interface CoverPosition { x: number; y: number }
export interface TripPresentation {
  summary: string | null;
  cover_card_position: CoverPosition | null;
  cover_hero_position: CoverPosition | null;
  cover_mobile_position: CoverPosition | null;
}

export const SUMMARY_MAX_LENGTH = 120;
export const CENTER_COVER: CoverPosition = { x: 50, y: 50 };

function isCoverPosition(value: unknown): value is CoverPosition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return Object.keys(point).length === 2 && [point.x, point.y].every(axis =>
    typeof axis === "number" && Number.isFinite(axis) && axis >= 0 && axis <= 100);
}

export function coverObjectPosition(value?: CoverPosition | null): string {
  const point = isCoverPosition(value) ? value : CENTER_COVER;
  return `${point.x}% ${point.y}%`;
}

/** Unedited mobile covers keep their original shared crop, including old backups. */
export function mobileCoverPosition(trip: Partial<TripPresentation>): CoverPosition {
  return trip.cover_mobile_position || trip.cover_hero_position || CENTER_COVER;
}

export function changeHeroCoverPosition(trip: Partial<TripPresentation>, device: "desktop" | "mobile", point: CoverPosition | null): Partial<TripPresentation> {
  if (device === "mobile") return { cover_mobile_position: point || { ...CENTER_COVER } };
  return { cover_hero_position: point, cover_mobile_position: { ...mobileCoverPosition(trip) } };
}

export function getTripExcerpt(trip: { summary?: string | null; content?: string | null }): string {
  const summary = trip.summary?.trim();
  const text = summary || trip.content?.replace(/[#*`>]/g, "").replace(/\s+/g, " ").trim();
  return text ? Array.from(text).slice(0, SUMMARY_MAX_LENGTH).join("") : "暂无文字记录";
}

/** Omitted fields stay omitted so older clients cannot erase editorial settings. */
export function validateTripPresentation(body: Record<string, unknown>): Partial<TripPresentation> {
  const result: Partial<TripPresentation> = {};
  if (Object.hasOwn(body, "summary")) {
    if (body.summary !== null && typeof body.summary !== "string") throw new Error("摘要必须是文字");
    const summary = (body.summary as string | null)?.replace(/\s+/g, " ").trim() || null;
    if (summary && Array.from(summary).length > SUMMARY_MAX_LENGTH) throw new Error("摘要最多 120 个字");
    result.summary = summary;
  }
  for (const field of ["cover_card_position", "cover_hero_position", "cover_mobile_position"] as const) {
    if (!Object.hasOwn(body, field)) continue;
    const value = body[field];
    if (value !== null && !isCoverPosition(value)) throw new Error("封面取景位置必须在 0 到 100 之间");
    result[field] = value === null ? null : { x: value.x, y: value.y };
  }
  return result;
}

export function changeTripCover<T extends Partial<Trip>>(trip: T, source: string): T {
  const cover = source || null;
  return (trip.cover_image || null) === cover ? trip : {
    ...trip, cover_image: cover, cover_card_position: null, cover_hero_position: null, cover_mobile_position: null,
  };
}

/** Object-position moves through the overflow, so drag distance must use that overflow. */
export function dragCoverPosition(start: CoverPosition, delta: CoverPosition, frame: { width: number; height: number }, image: { width: number; height: number }): CoverPosition {
  if (frame.width <= 0 || frame.height <= 0 || image.width <= 0 || image.height <= 0) return start;
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const overflowX = image.width * scale - frame.width;
  const overflowY = image.height * scale - frame.height;
  const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
  return {
    x: overflowX > 0.5 ? clamp(start.x - delta.x / overflowX * 100) : start.x,
    y: overflowY > 0.5 ? clamp(start.y - delta.y / overflowY * 100) : start.y,
  };
}
