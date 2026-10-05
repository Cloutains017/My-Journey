import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
type InputEventStub = { target: { value: string }; currentTarget: { value: string }; nativeEvent: { isComposing: boolean } };
type Element = { type: unknown; props: Record<string, unknown> & {
  onChange(event: InputEventStub): void; onClick(): void;
  onCompositionStart?(event: unknown): void;
  onCompositionEnd?(event: { target: { value: string }; currentTarget: { value: string } }): void;
} };
function find(node: unknown, predicate: (element: Element) => boolean): Element | undefined {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== "object" || !("props" in node)) return;
  const element = node as Element;
  return predicate(element) ? element : find(element.props.children, predicate);
}

async function mount(search = "") {
  const compile = (source: string) => ts.transpileModule(source, { compilerOptions: {
    esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const browsing = { exports: {} };
  new Function("require", "module", "exports", compile(await readFile("src/lib/journey-browsing.ts", "utf8")))(require, browsing, browsing.exports);
  let params = new URLSearchParams(search);
  const writes: string[] = [];
  const location = { pathname: "/", search, hash: "#journey-explorer" };
  const record = (_state: unknown, _title: string, url: string) => {
    writes.push(url);
    location.search = new URL(url, "https://journey.example").search;
    // Router props can arrive later than the input event.
  };
  let cursor = 0;
  const hooks: unknown[] = [];
  const react = { ...require("react"),
    useState(initial: unknown) { const index = cursor++; if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
      return [hooks[index], (value: unknown) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }]; },
    useRef(initial: unknown) { return hooks[cursor++] ??= { current: initial }; },
  };
  const component = { exports: {} as { default(props: unknown): Element } };
  new Function("require", "module", "exports", "window", compile(await readFile("src/components/JourneyExplorer.tsx", "utf8")))((id: string) => {
    if (id === "react") return react;
    if (id === "next/navigation") return { useSearchParams: () => params };
    if (id === "@/components/YearNav") return "year-nav";
    if (id === "@/components/JourneyCardList") return "journey-card-list";
    if (id === "@/lib/journey-browsing") return browsing.exports;
    if (id === "@/lib/types") return { RATING_LABELS: { 5: "夯" } };
    return require(id);
  }, component, component.exports, { location, history: { replaceState: record, pushState: record } });
  const items = [
    { id: "a", kind: "trip", title: "福州", city_name: "福州", location: "福建", date: "2026-01-01", rating: 5, content: "福州游记" },
    { id: "b", kind: "trip", title: "厦门", city_name: "厦门", location: "福建", date: "2025-01-01", rating: 3, content: "厦门游记" },
  ];
  const render = () => { let tree!: Element; for (let i = 0; i < 2; i++) { cursor = 0; tree = component.exports.default({ items }); } return tree; };
  const input = () => find(render(), node => node.props.id === "journey-query")!;
  const change = (value: string, isComposing = false) => input().props.onChange({ target: { value }, currentTarget: { value }, nativeEvent: { isComposing } });
  const flushUrl = (next = location.search) => { params = new URLSearchParams(next); location.search = next; render(); };
  const reflectUrl = (next: string) => { params = new URLSearchParams(next); render(); };
  return { render, input, change, writes, flushUrl, reflectUrl };
}

test("pinyin composition keeps the draft locally and writes only the committed Chinese query", async () => {
  const view = await mount();
  view.input().props.onCompositionStart?.({});
  view.change("fu", true);
  assert.equal(view.input().props.value, "fu", "an async URL must not overwrite the composing draft");
  view.change("福zhou", false); // Composition events must also guard keyboards with a false flag.
  assert.equal(view.input().props.value, "福zhou");
  assert.equal(view.writes.length, 0, "candidate edits must not update the router");
  view.input().props.onCompositionEnd?.({ currentTarget: { value: "福州" }, target: { value: "福州" } });
  view.change("福州"); // Some keyboards emit a final input after compositionend.
  view.flushUrl();
  assert.equal(view.input().props.value, "福州");
  assert.equal(view.writes.length, 1);
  assert.equal(new URL(view.writes[0], "https://journey.example").searchParams.get("q"), "福州");
});

test("ordinary input updates immediately, browser history restores it, and clearing resets the draft", async () => {
  const view = await mount("?q=旧词");
  view.change("新词");
  assert.equal(view.input().props.value, "新词");
  view.flushUrl();
  view.flushUrl("?q=返回的词");
  assert.equal(view.input().props.value, "返回的词");
  find(view.render(), node => node.type === "button" && node.props.children === "清除筛选")!.props.onClick();
  view.flushUrl();
  assert.equal(view.input().props.value, "");
});

test("year navigation stays available while obsolete year URL parameters cannot hide journeys", async () => {
  const view = await mount("?year=2026");
  const tree = view.render();
  assert.equal(find(tree, node => node.props.id === "journey-year"), undefined);
  assert.deepEqual(find(tree, node => node.type === "year-nav")?.props.years, [2026, 2025]);
});

test("late router snapshots cannot roll back newer typing or committed Chinese text", async () => {
  const view = await mount();
  view.change("f");
  view.change("fu");
  view.reflectUrl("?q=f");
  assert.equal(view.input().props.value, "fu");
  view.input().props.onCompositionStart?.({});
  view.change("fuzhou", true);
  view.input().props.onCompositionEnd?.({ currentTarget: { value: "福州" }, target: { value: "福州" } });
  view.reflectUrl("?q=fu");
  assert.equal(view.input().props.value, "福州");
  view.flushUrl();
  assert.equal(view.input().props.value, "福州");
});
