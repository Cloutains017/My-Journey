import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const years = [2026, 2025, 2024];

async function mountYearNav(nativeScrollEnd = false) {
  const source = await readFile("src/components/YearNav.tsx", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: (() => (() => void) | undefined)[] = [];
  const effectDependencies: unknown[][] = [];
  const cleanups: ((() => void) | undefined)[] = [];
  const listeners = new Map<string, (event?: { key: string }) => void>();
  const timers = new Map<number, () => void>();
  const scrollRequests: { year: number; options: unknown }[] = [];
  let cursor = 0;
  let refCursor = 0;
  let effectCursor = 0;
  let currentYears = years;
  let mounted = false;
  let timerId = 0;
  let observe: (() => void) | undefined;
  let disconnected = false;
  const viewport = {
    innerHeight: 1000, scrollY: 0, scrollHeight: 10000, reducedMotion: false,
    matchMedia: () => ({ matches: viewport.reducedMotion }),
    getComputedStyle: () => ({ scrollMarginTop: "0px" }),
    addEventListener: (name: string, callback: (event: { key: string; type: string }) => void) => listeners.set(name, event => callback({ key: "", ...event, type: name })),
    removeEventListener: (name: string) => listeners.delete(name),
    setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => timers.delete(id),
  };
  if (nativeScrollEnd) Object.assign(viewport, { onscrollend: null });
  const sections = new Map(years.map((year, index) => [year, {
    getBoundingClientRect: () => ({ top: index * 1000 - viewport.scrollY, bottom: (index + 1) * 1000 - viewport.scrollY }),
    scrollIntoView: (options: unknown) => scrollRequests.push({ year, options }),
  }]));
  const react = {
    ...require("react"),
    useState(initial: unknown) {
      const i = cursor++;
      if (i >= states.length) states[i] = initial;
      return [states[i], (value: unknown) => { states[i] = value; }];
    },
    useRef(initial: unknown) { return refs[refCursor++] ??= { current: initial }; },
    useEffect(effect: () => (() => void) | undefined, dependencies: unknown[]) {
      const i = effectCursor++;
      const previous = effectDependencies[i];
      if (!previous || dependencies.some((value, index) => !Object.is(value, previous[index]))) {
        effectDependencies[i] = dependencies;
        effects.push(() => { cleanups[i]?.(); cleanups[i] = effect(); return undefined; });
      }
    },
  };
  class Observer {
    constructor(callback: () => void) { observe = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  }
  const component = { exports: {} as { default: (props: { years: number[] }) => unknown } };
  new Function("require", "module", "exports", "window", "document", "IntersectionObserver", compiled)(
    (id: string) => id === "react" ? react : require(id), component, component.exports, viewport,
    { documentElement: viewport, getElementById: (id: string) => sections.get(Number(id.replace("year-", ""))) }, Observer,
  );
  const flushEffects = () => { effects.splice(0).forEach(effect => effect()); };
  const render = () => {
    cursor = 0; refCursor = 0; effectCursor = 0;
    const result = component.exports.default({ years: currentYears });
    if (mounted) flushEffects();
    return result;
  };
  render();
  mounted = true;
  flushEffects();
  const buttons = () => {
    const nav = render() as { props: { children: [unknown, { props: { children: [unknown, { props: { "data-year": number; "aria-current"?: string; onClick(): void } }[]] } }] } };
    return nav.props.children[1].props.children[1];
  };
  return {
    viewport, sections, timers, listeners, scrollRequests,
    click: (year: number) => buttons().find(button => button.props["data-year"] === year)!.props.onClick(),
    active: () => buttons().find(button => button.props["aria-current"])?.props["data-year"],
    intersect: () => observe?.(),
    settle: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); },
    dispose: () => cleanups.forEach(cleanup => cleanup?.()),
    disconnected: () => disconnected,
    rerenderYears: () => { currentYears = [...currentYears]; render(); },
  };
}

test("equivalent year arrays from a parent render cannot reset an active jump", async () => {
  const view = await mountYearNav();
  view.click(2024); view.rerenderYears();
  view.viewport.scrollY = 1000; view.listeners.get("scroll")?.(); view.intersect();
  assert.equal(view.active(), 2024);
  view.dispose();
});

test("native scrollend keeps the destination locked through pauses between smooth-scroll frames", async () => {
  const view = await mountYearNav(true);
  view.click(2024); view.viewport.scrollY = 1000;
  view.listeners.get("scroll")?.(); view.settle(); view.intersect();
  assert.equal(view.active(), 2024);
  view.viewport.scrollY = 2000; view.listeners.get("scrollend")?.();
  view.viewport.scrollY = 1000; view.intersect();
  assert.equal(view.active(), 2025);
  view.dispose();
});

test("native scrollend catches up after cancellation and no-op jumps still unlock", async () => {
  const view = await mountYearNav(true);
  view.click(2024); view.viewport.scrollY = 1000;
  view.listeners.get("scrollend")?.();
  assert.equal(view.active(), 2025);
  view.click(2025); view.settle();
  view.viewport.scrollY = 0; view.intersect();
  assert.equal(view.active(), 2026);
  view.dispose();
});

test("year jumps keep the clicked year active while passing intermediate sections", async () => {
  const view = await mountYearNav();
  view.click(2024);
  view.viewport.scrollY = 1000;
  view.listeners.get("scroll")?.(); view.intersect();
  assert.equal(view.active(), 2024);
  view.viewport.scrollY = 2000;
  view.listeners.get("scroll")?.(); view.intersect(); view.settle();
  assert.equal(view.active(), 2024);
  // Ordinary scrolling resumes after the jump settles.
  view.viewport.scrollY = 1000; view.intersect();
  assert.equal(view.active(), 2025);
  view.dispose();
});

test("another year click replaces the destination without intermediate highlighting", async () => {
  const view = await mountYearNav();
  view.click(2024); view.click(2026);
  view.viewport.scrollY = 1000; view.intersect();
  assert.equal(view.active(), 2026);
  assert.equal(view.scrollRequests.at(-1)?.year, 2026);
  view.dispose();
});

test("a jump stopped with the scrollbar catches up when scrolling settles", async () => {
  const view = await mountYearNav();
  view.click(2024); view.viewport.scrollY = 1000;
  view.listeners.get("scroll")?.(); view.intersect();
  assert.equal(view.active(), 2024);
  view.settle();
  assert.equal(view.active(), 2025);
  view.dispose();
});

test("a short final year stays selected when the page cannot align it at the top", async () => {
  const view = await mountYearNav();
  view.sections.set(2024, { ...view.sections.get(2024)!, getBoundingClientRect: () => ({ top: 2000 - view.viewport.scrollY, bottom: 2250 - view.viewport.scrollY }) });
  view.viewport.scrollHeight = 2500;
  view.click(2024); view.viewport.scrollY = 1500;
  view.listeners.get("scroll")?.(); view.intersect(); view.settle();
  assert.equal(view.active(), 2024);
  view.dispose();
});

test("a partly visible destination cannot mask scrollbar cancellation before reaching its year", async () => {
  const view = await mountYearNav();
  view.click(2025); view.viewport.scrollY = 400;
  view.listeners.get("scroll")?.(); view.intersect(); view.settle();
  assert.equal(view.active(), 2026);
  view.dispose();
});

test("scrollbar overshoot follows the next year even if the target's tail is visible", async () => {
  const view = await mountYearNav();
  view.click(2025); view.viewport.scrollY = 1900;
  view.listeners.get("scroll")?.(); view.intersect(); view.settle();
  assert.equal(view.active(), 2024);
  view.dispose();
});

test("an aligned short section stays selected even if it ends above the tracking anchor", async () => {
  const view = await mountYearNav();
  view.sections.set(2025, { ...view.sections.get(2025)!, getBoundingClientRect: () => ({ top: 1000 - view.viewport.scrollY, bottom: 1250 - view.viewport.scrollY }) });
  view.click(2025); view.viewport.scrollY = 1000;
  view.listeners.get("scroll")?.(); view.intersect(); view.settle();
  assert.equal(view.active(), 2025);
  view.dispose();
});

test("manual wheel, touch, and scrolling keys release a pending year jump", async () => {
  for (const [event, key] of [["wheel", ""], ["touchstart", ""], ["keydown", "PageUp"]]) {
    const view = await mountYearNav();
    view.click(2024); view.viewport.scrollY = 1000;
    view.listeners.get(event)?.({ key }); view.intersect();
    assert.equal(view.active(), 2025, event);
    view.dispose();
  }
});

test("unrelated keys keep the selected destination and reduced motion jumps instantly", async () => {
  const view = await mountYearNav();
  view.viewport.reducedMotion = true; view.click(2024);
  assert.deepEqual(view.scrollRequests.at(-1), { year: 2024, options: { behavior: "instant", block: "start" } });
  view.viewport.scrollY = 1000;
  view.listeners.get("keydown")?.({ key: "Tab" }); view.intersect();
  assert.equal(view.active(), 2024);
  view.settle(); view.intersect();
  assert.equal(view.active(), 2025);
  view.dispose();
});

test("missing sections are ignored and unmount clears scroll listeners and timers", async () => {
  const view = await mountYearNav();
  view.sections.delete(2024); view.click(2024);
  assert.equal(view.active(), 2026);
  assert.equal(view.scrollRequests.length, 0);
  view.click(2025); view.dispose();
  assert.equal(view.timers.size, 0);
  assert.equal(view.listeners.size, 0);
  assert.equal(view.disconnected(), true);
});
