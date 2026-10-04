import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
import type { Photo } from "../src/lib/types.ts";

const require = createRequire(import.meta.url);
type Element = { type: unknown; props: Record<string, unknown> & { children?: unknown; onClick?: () => void } };
function elements(node: unknown, predicate: (element: Element) => boolean): Element[] {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate));
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [...(predicate(element) ? [element] : []), ...elements(element.props.children, predicate)];
}
const photos = Array.from({ length: 53 }, (_, i) => ({ id: `photo-${i}`, trip_id: "trip", url: `https://photos.example/${i}.jpg`, caption: null,
  width: i % 2 ? 800 : 1600, height: i % 2 ? 1200 : 900, sort_order: i, created_at: "2026-01-01" } as Photo));

async function load(path: string, localRequire: (id: string) => unknown) {
  const compiled = ts.transpileModule(await readFile(path, "utf8").catch(() => ""), { compilerOptions: {
    esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const result = { exports: {} as { default: (props: unknown) => unknown } };
  new Function("require", "module", "exports", compiled)(localRequire, result, result.exports);
  assert.equal(typeof result.exports.default, "function", `${path} must expose a component`);
  return result.exports.default;
}

async function mountGallery(items = photos) {
  let cursor = 0;
  const hooks: unknown[] = [];
  const effects: Array<() => void> = [];
  let focused = false;
  const react = { ...require("react"),
    useState(initial: unknown) { const index = cursor++; if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
      return [hooks[index], (value: unknown) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }]; },
    useRef(initial: unknown) { return hooks[cursor++] ??= { current: initial === null ? { focus: () => { focused = true; } } : initial }; },
    useEffect(effect: () => void) { effects.push(effect); },
  };
  const Gallery = await load("src/components/PhotoGallery.tsx", id => {
    if (id === "react") return react;
    if (id === "next/dynamic") return () => "photo-lightbox";
    if (id === "@/components/TravelImage") return "travel-image";
    return require(id);
  });
  const render = () => { cursor = 0; effects.length = 0; const result = Gallery({ photos: items, title: "山水", id: "photo-group-a" }); effects.forEach(effect => effect()); return result; };
  const tiles = () => elements(render(), node => String(node.props.className).includes("photo-gallery-tile"));
  const more = () => elements(render(), node => node.props["aria-controls"] === "photo-group-a-grid")[0];
  return { render, tiles, more, focused: () => focused };
}

test("long galleries expand in stable batches and stop at the total without repeating photos", async () => {
  const view = await mountGallery();
  assert.equal(view.tiles().length, 24);
  const firstIds = view.tiles().map(tile => tile.props["aria-label"]);
  view.more().props.onClick!();
  assert.equal(view.tiles().length, 48);
  assert.deepEqual(view.tiles().slice(0, 24).map(tile => tile.props["aria-label"]), firstIds);
  assert.equal(elements(view.render(), node => String(node.props.className).includes("photo-gallery-grid")).length, 2);
  assert.ok(view.tiles()[24].props.ref, "focus moves to the first new photo so Tab can continue through the batch");
  assert.equal(view.focused(), true);
  view.more().props.onClick!();
  assert.equal(view.tiles().length, 53);
  assert.equal(view.more(), undefined);
  assert.ok(view.tiles()[48].props.ref, "the final expansion also focuses its first new photo");
  assert.equal(view.focused(), true);
});

test("lightbox receives every photo and the correct index from an expanded batch", async () => {
  const view = await mountGallery();
  view.more().props.onClick!();
  view.tiles()[25].props.onClick!();
  const lightbox = elements(view.render(), node => node.type === "photo-lightbox")[0];
  assert.equal(lightbox.props.photos, photos);
  assert.equal(lightbox.props.initialIndex, 25);
});

test("empty and small galleries need no expansion controls", async () => {
  assert.equal((await mountGallery([])).render(), null);
  const small = await mountGallery(photos.slice(0, 8));
  assert.equal(small.tiles().length, 8);
  assert.equal(small.more(), undefined);
  assert.equal(small.focused(), false);
});

test("photo previews keep intrinsic dimensions and natural height without cropping even with missing metadata", async () => {
  const originals = [photos[0], photos[1], { ...photos[2], width: null, height: null }];
  const view = await mountGallery(originals);
  const images = elements(view.render(), node => node.type === "travel-image");
  assert.equal(images.length, 3);
  assert.deepEqual(images.slice(0, 2).map(image => [image.props.width, image.props.height]), [[1600, 900], [800, 1200]]);
  for (const image of images) {
    assert.equal(image.props.fill, undefined);
    assert.ok(String(image.props.className).includes("h-auto"));
    assert.ok(!String(image.props.className).includes("object-cover"));
  }
  for (const tile of view.tiles()) assert.equal((tile.props.style as { aspectRatio?: string } | undefined)?.aspectRatio, undefined);
});

test("group navigation points to the existing gallery sections and is omitted for a single album", async () => {
  const Albums = await load("src/components/PhotoAlbums.tsx", id => id === "@/components/PhotoGallery" ? "photo-gallery" : require(id));
  const groups = [{ id: "a", title: "桂林", photos: photos.slice(0, 2) }, { id: "unassigned", title: "未分组", photos: photos.slice(2) }];
  const tree = Albums({ groups });
  assert.deepEqual(elements(tree, node => node.type === "a").map(link => link.props.href), ["#photo-group-a", "#photo-group-unassigned"]);
  assert.deepEqual(elements(tree, node => node.type === "photo-gallery").map(gallery => gallery.props.id), ["photo-group-a", "photo-group-unassigned"]);
  assert.equal(elements(Albums({ groups: groups.slice(0, 1) }), node => node.type === "nav").length, 0);
});
