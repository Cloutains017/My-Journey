import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);

// Exercise the component's effect with controlled viewport and article geometry.
async function mountProgress(scrollY = 0) {
  const source = await readFile("src/components/ReadingProgress.tsx", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const bar = { style: {} as Record<string, string> };
  const listeners = new Map<string, () => void>();
  const frames = new Map<number, () => void>();
  let frameId = 0;
  let resize: (() => void) | undefined;
  let cleanup: (() => void) | undefined;
  let mounted = false;
  let topFocused = false;
  let scrollRequest: unknown;
  let stateCursor = 0;
  const states: unknown[] = [];
  let refCursor = 0;
  const refs: { current: unknown }[] = [];
  const geometry = { start: 1000, height: 2000 };
  const viewport = {
    scrollY, innerHeight: 864, reducedMotion: false,
    matchMedia: () => ({ matches: viewport.reducedMotion }),
    scrollTo: (options: unknown) => { scrollRequest = options; },
    addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name),
    requestAnimationFrame: (callback: () => void) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  const article = { getBoundingClientRect: () => ({ top: geometry.start - viewport.scrollY, height: geometry.height }) };
  const fakeDocument = { getElementById: (id: string) => id === "trip-reading" ? article : id === "trip-top" ? { focus: () => { topFocused = true; } } : null, body: {}, documentElement: {
    scrollTop: scrollY, scrollHeight: 6000, clientHeight: 864,
  } };
  const react = {
    ...require("react"),
    useState(initial: unknown) {
      const i = stateCursor++;
      if (i >= states.length) states[i] = initial;
      return [states[i], (value: unknown) => { states[i] = typeof value === "function" ? value(states[i]) : value; }];
    },
    useRef(initial: unknown) { return refs[refCursor++] ??= { current: initial === null ? bar : initial }; },
    useEffect(effect: () => (() => void) | undefined) { if (!mounted) { mounted = true; cleanup = effect(); } },
  };
  const compiledModule = { exports: {} as { default: () => unknown } };
  const localRequire = (id: string) => id === "react" ? react : require(id);
  class Observer {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() { resize = undefined; }
  }
  new Function("require", "module", "exports", "window", "document", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", compiled)(
    localRequire, compiledModule, compiledModule.exports, viewport, fakeDocument, Observer, viewport.requestAnimationFrame, viewport.cancelAnimationFrame,
  );
  const render = () => { stateCursor = 0; refCursor = 0; return compiledModule.exports.default(); };
  render();
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); };
  return { bar, geometry, viewport, listeners, frames, flush, render, topFocused: () => topFocused, scrollRequest: () => scrollRequest, resize: () => resize?.(), dispose: () => cleanup?.() };
}

function findTopButton(node: unknown): { props: { onClick(): void } } | undefined {
  if (Array.isArray(node)) {
    for (const child of node) { const result = findTopButton(child); if (result) return result; }
  } else if (node && typeof node === "object" && "props" in node) {
    const element = node as { props: { "aria-label"?: string; children?: unknown; onClick(): void } };
    if (element.props["aria-label"] === "返回顶部") return element;
    return findTopButton(element.props.children);
  }
}

test("reading progress starts at the article and finishes before the voting area", async () => {
  const view = await mountProgress();
  view.flush();
  assert.equal(view.bar.style.transform, "scaleX(0)");
  view.viewport.scrollY = 1536; // Halfway through 1200px of readable scrolling.
  view.listeners.get("scroll")?.(); view.flush();
  assert.equal(view.bar.style.transform, "scaleX(0.5)");
  view.viewport.scrollY = 4000; // Beyond the article, in comments/footer.
  view.listeners.get("scroll")?.(); view.flush();
  assert.equal(view.bar.style.transform, "scaleX(1)");
  view.dispose();
});

test("restored scroll and resized photo layouts update progress without another scroll", async () => {
  const view = await mountProgress(1536);
  view.flush();
  assert.equal(view.bar.style.transform, "scaleX(0.5)");
  view.geometry.height = 3200;
  view.resize(); view.flush();
  assert.equal(view.bar.style.transform, "scaleX(0.25)");
  view.dispose();
});

test("scroll updates are batched and pending work is cancelled on unmount", async () => {
  const view = await mountProgress();
  view.flush();
  for (let i = 0; i < 10; i++) view.listeners.get("scroll")?.();
  assert.equal(view.frames.size, 1);
  view.dispose();
  assert.equal(view.frames.size, 0);
  assert.equal(view.listeners.size, 0);
});

test("a short article is complete when entirely in view and never produces NaN", async () => {
  const view = await mountProgress();
  view.geometry.height = 400;
  view.flush();
  assert.equal(view.bar.style.transform, "scaleX(0)");
  view.viewport.scrollY = 936;
  view.listeners.get("scroll")?.(); view.flush();
  assert.equal(view.bar.style.transform, "scaleX(1)");
  view.dispose();
});

test("back to top appears after reading, restores focus, and respects reduced motion", async () => {
  const view = await mountProgress();
  view.flush();
  assert.equal(findTopButton(view.render()), undefined);
  view.viewport.scrollY = 1536;
  view.listeners.get("scroll")?.(); view.flush();
  const button = findTopButton(view.render());
  assert.ok(button);
  button.props.onClick();
  assert.deepEqual(view.scrollRequest(), { top: 0, behavior: "smooth" });
  assert.equal(view.topFocused(), true);
  view.viewport.reducedMotion = true;
  button.props.onClick();
  assert.deepEqual(view.scrollRequest(), { top: 0, behavior: "instant" });
  view.viewport.scrollY = 0;
  view.listeners.get("scroll")?.(); view.flush();
  assert.equal(findTopButton(view.render()), undefined);
  view.dispose();
});
