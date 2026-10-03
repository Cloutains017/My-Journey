import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
type Element = { type: unknown; props: Record<string, unknown> };

function find(node: unknown, predicate: (node: Element) => boolean): Element | undefined {
  if (Array.isArray(node)) {
    for (const child of node) { const result = find(child, predicate); if (result) return result; }
  } else if (node && typeof node === "object" && "props" in node) {
    const element = node as Element;
    if (predicate(element)) return element;
    return find(element.props.children, predicate);
  }
}

async function mountLightbox(count = 3) {
  const source = await readFile("src/components/PhotoLightbox.tsx", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  let cursor = 0;
  let refCursor = 0;
  const react = {
    ...require("react"),
    useState(initial: unknown) {
      const index = cursor++;
      if (index >= states.length) states[index] = initial;
      return [states[index], (next: unknown) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef(initial: unknown) { return refs[refCursor++] ??= { current: initial }; },
    useCallback(callback: unknown) { return callback; },
    useEffect() {},
  };
  const compiledModule = { exports: {} as { default: (props: Record<string, unknown>) => unknown } };
  const localRequire = (id: string) => {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return require(id);
    if (id === "@/components/TravelImage") return { default: () => null };
    throw new Error(`Unexpected dependency: ${id}`);
  };
  new Function("require", "module", "exports", compiled)(localRequire, compiledModule, compiledModule.exports);
  const photos = Array.from({ length: count }, (_, index) => ({ id: `photo-${index}`, url: `/photo-${index}.jpg`, caption: null }));
  const render = () => {
    cursor = 0; refCursor = 0;
    return compiledModule.exports.default({ photos, initialIndex: 0, title: "旅途影像", onClose() {} });
  };
  const counter = () => find(render(), node => node.props.className === "lightbox-counter")?.props.children;
  const swipe = (dx: number, dy: number, pointerType = "touch", cancel = false) => {
    const stage = find(render(), node => node.props.className === "lightbox-stage")!;
    const down = stage.props.onPointerDown as (event: Record<string, unknown>) => void;
    const up = stage.props.onPointerUp as (event: Record<string, unknown>) => void;
    down({ pointerType, isPrimary: true, pointerId: 1, clientX: 200, clientY: 200 });
    if (cancel) (stage.props.onPointerCancel as () => void)();
    up({ pointerId: 1, clientX: 200 + dx, clientY: 200 + dy });
  };
  return { render, counter, swipe };
}

test("lightbox touch swipes move in the intended direction and wrap at the ends", async () => {
  const box = await mountLightbox();
  box.swipe(-90, 5);
  assert.deepEqual(box.counter(), [2, " / ", 3]);
  box.swipe(90, 5);
  box.swipe(90, 5);
  assert.deepEqual(box.counter(), [3, " / ", 3]);
});

test("lightbox ignores taps, vertical gestures, mouse drags, and cancelled gestures", async () => {
  const box = await mountLightbox();
  box.swipe(-10, 0);
  box.swipe(-70, 120);
  box.swipe(-90, 0, "mouse");
  box.swipe(-90, 0, "touch", true);
  assert.deepEqual(box.counter(), [1, " / ", 3]);
});

test("single-photo lightbox stays on its only photo and disables navigation", async () => {
  const box = await mountLightbox(1);
  box.swipe(-90, 0);
  assert.deepEqual(box.counter(), [1, " / ", 1]);
  assert.equal(find(box.render(), node => node.props["aria-label"] === "下一张照片")?.props.disabled, true);
  assert.equal(find(box.render(), node => node.props["aria-label"] === "上一张照片")?.props.disabled, true);
});
