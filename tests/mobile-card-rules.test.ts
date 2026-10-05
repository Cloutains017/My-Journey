import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Exercise the controller with controlled browser geometry, not scroll timing.
async function mount(mobile = true) {
  const source = await readFile("src/lib/mobile-card-rules.ts", "utf8");
  const controller = { exports: {} as { observeMobileCardRules: (root: HTMLElement) => () => void } };
  let mediaChange: (() => void) | undefined;
  let resize: (() => void) | undefined;
  let intersection: (() => void) | undefined;
  const media = { matches: mobile,
    addEventListener: (_: string, fn: () => void) => { mediaChange = fn; },
    removeEventListener: () => { mediaChange = undefined; },
  };
  const viewport = { innerHeight: 800, matchMedia: () => media,
    addEventListener: (_: string, fn: () => void) => { resize = fn; },
    removeEventListener: () => { resize = undefined; },
  };
  const cards = [
    { bounds: { top: 100, bottom: 500 }, dataset: {} as Record<string, string> },
    { bounds: { top: 500, bottom: 660 }, dataset: {} as Record<string, string> },
    { bounds: { top: 660, bottom: 1300 }, dataset: {} as Record<string, string> },
  ].map(card => ({ ...card, getBoundingClientRect: () => card.bounds }));
  const root = { querySelectorAll: () => cards };
  class Observer {
    constructor(fn: () => void) { intersection = fn; }
    observe() {}
    disconnect() { intersection = undefined; }
  }
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  new Function("module", "exports", "window", "IntersectionObserver", compiled)(controller, controller.exports, viewport, Observer);
  const cleanup = controller.exports.observeMobileCardRules(root as unknown as HTMLElement);
  return { cards, viewport, cleanup,
    active: () => cards.map((card, i) => card.dataset.scrollActive === "true" ? i : -1).filter(i => i >= 0),
    scroll: (pixels: number) => { cards.forEach(card => { card.bounds.top -= pixels; card.bounds.bottom -= pixels; }); intersection?.(); },
    setMobile: (matches: boolean) => { media.matches = matches; mediaChange?.(); },
    resize: (height: number) => { viewport.innerHeight = height; resize?.(); },
  };
}

test("mobile scrolling hands the highlight from trip to education and back", async () => {
  const view = await mount();
  assert.deepEqual(view.active(), [0]);
  view.scroll(200);
  assert.deepEqual(view.active(), [1]);
  view.scroll(200);
  assert.deepEqual(view.active(), [2]);
  view.scroll(-400);
  assert.deepEqual(view.active(), [0]);
  view.cleanup();
});

test("tall mobile cards stay selected even when less than half of them is visible", async () => {
  const view = await mount();
  view.cards[0].bounds = { top: -800, bottom: 800 };
  view.cards[1].bounds = { top: 800, bottom: 960 };
  view.cards[2].bounds = { top: 960, bottom: 1600 };
  view.scroll(0);
  assert.deepEqual(view.active(), [0]);
  view.cleanup();
});

test("scrolling out of cards or into a year gap clears the highlight", async () => {
  const view = await mount();
  view.scroll(-1000);
  assert.deepEqual(view.active(), []);
  view.scroll(1160);
  view.cards[1].bounds.top = 440;
  view.scroll(0);
  assert.deepEqual(view.active(), []);
  view.cleanup();
});

test("desktop has no scroll highlight and changing layout resets mobile state", async () => {
  const view = await mount(false);
  assert.deepEqual(view.active(), []);
  view.setMobile(true);
  assert.deepEqual(view.active(), [0]);
  view.setMobile(false);
  assert.deepEqual(view.active(), []);
  view.cleanup();
});

test("viewport resize recalculates which card contains the screen midpoint", async () => {
  const view = await mount();
  view.resize(1200);
  assert.deepEqual(view.active(), [1]);
  view.cleanup();
});

test("unmount clears highlighting and prevents later scroll or resize updates", async () => {
  const view = await mount();
  view.cleanup();
  view.scroll(200); view.resize(1200); view.setMobile(true);
  assert.deepEqual(view.active(), []);
});
