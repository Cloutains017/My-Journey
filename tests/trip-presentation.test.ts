import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getTripExcerpt, coverObjectPosition, validateTripPresentation, changeTripCover,
  dragCoverPosition,
} from "../src/lib/trip-presentation.ts";

test("home excerpts prefer an edited summary and fall back to readable legacy content", () => {
  assert.equal(getTripExcerpt({ summary: "  暴雨后的城市  ", content: "正文开头" }), "暴雨后的城市");
  assert.equal(getTripExcerpt({ summary: " \n ", content: "> 山路\n\n**日落**" }), "山路 日落");
  assert.equal(getTripExcerpt({ content: null }), "暂无文字记录");
  const excerpt = getTripExcerpt({ content: "山".repeat(119) + "🌄尾声" });
  assert.equal(Array.from(excerpt).length, 120);
  assert.ok(excerpt.endsWith("🌄"));
});

test("presentation writes normalize summaries, preserve omitted fields, and reject unsafe positions", () => {
  assert.deepEqual(validateTripPresentation({ summary: " 山路\n 日落 ", cover_card_position: { x: 0, y: 100 } }), {
    summary: "山路 日落", cover_card_position: { x: 0, y: 100 },
  });
  assert.deepEqual(validateTripPresentation({ title: "旧客户端" }), {});
  assert.deepEqual(validateTripPresentation({ summary: "  ", cover_hero_position: null }), { summary: null, cover_hero_position: null });
  assert.doesNotThrow(() => validateTripPresentation({ summary: "🌄".repeat(120) }));
  for (const summary of ["山".repeat(121), 12, {}]) assert.throws(() => validateTripPresentation({ summary }), /摘要/);
  for (const value of [{ x: -1, y: 50 }, { x: 50, y: 101 }, { x: "50", y: 50 }, { x: Infinity, y: 50 }, { x: NaN, y: 50 }, { x: 50 }, [], "center", { x: 50, y: 50, url: "other" }]) {
    assert.throws(() => validateTripPresentation({ cover_hero_position: value }), /取景/);
  }
});

test("legacy cover positions render centered and separate placements keep separate crops", () => {
  assert.equal(coverObjectPosition(undefined), "50% 50%");
  assert.equal(coverObjectPosition(null), "50% 50%");
  assert.equal(coverObjectPosition({ x: 20, y: 75 }), "20% 75%");
  assert.equal(coverObjectPosition({ x: 150, y: 25 }), "50% 50%");
});

test("changing the cover resets both crops while reselecting the same photo preserves them", () => {
  const trip = { title: "山路", cover_image: "a.jpg", cover_card_position: { x: 20, y: 80 }, cover_hero_position: { x: 60, y: 10 } };
  assert.deepEqual(changeTripCover(trip, "a.jpg"), trip);
  assert.deepEqual(changeTripCover(trip, "b.jpg"), { ...trip, cover_image: "b.jpg", cover_card_position: null, cover_hero_position: null });
  assert.equal(changeTripCover(trip, "").cover_image, null);
});

test("dragging follows the photo, clamps at its edges, and ignores axes without crop overflow", () => {
  // A 1200x800 photo in a 300x300 frame renders 450x300, with 150px horizontal overflow.
  assert.deepEqual(dragCoverPosition({ x: 50, y: 50 }, { x: 30, y: 40 }, { width: 300, height: 300 }, { width: 1200, height: 800 }), { x: 30, y: 50 });
  assert.deepEqual(dragCoverPosition({ x: 50, y: 50 }, { x: -500, y: 0 }, { width: 300, height: 300 }, { width: 1200, height: 800 }), { x: 100, y: 50 });
  // A portrait photo fills a landscape frame; only vertical positioning can change.
  assert.deepEqual(dragCoverPosition({ x: 50, y: 50 }, { x: 40, y: 90 }, { width: 400, height: 300 }, { width: 800, height: 1200 }), { x: 50, y: 20 });
  assert.deepEqual(dragCoverPosition({ x: 20, y: 60 }, { x: 50, y: 20 }, { width: 0, height: 0 }, { width: 0, height: 0 }), { x: 20, y: 60 });
});
