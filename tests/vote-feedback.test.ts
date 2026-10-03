import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
import { ACTIVE_VOTE_COLORS, VOTE_COLORS } from "../src/components/voteStyles.ts";
import { AGREEMENT_LABELS, DESIRE_LABELS } from "../src/lib/types.ts";

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

async function mountVote(path: string, request: typeof fetch) {
  const source = await readFile(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const states: unknown[] = [2, "旅人", "风景很好", false, false];
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
    useRef(initial: unknown) {
      const index = refCursor++;
      return refs[index] ??= { current: initial };
    },
  };
  const compiledModule = { exports: {} as { default: (props: { tripId: string }) => unknown } };
  const localRequire = (id: string) => {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return require(id);
    if (id === "@/lib/types") return { AGREEMENT_LABELS, DESIRE_LABELS };
    if (id === "@/components/voteStyles") return { ACTIVE_VOTE_COLORS, VOTE_COLORS };
    throw new Error(`Unexpected dependency: ${id}`);
  };
  new Function("require", "module", "exports", "fetch", compiled)(localRequire, compiledModule, compiledModule.exports, request);
  const render = () => {
    cursor = 0; refCursor = 0;
    return compiledModule.exports.default({ tripId: "trip-1" });
  };
  const submit = (tree: unknown) => {
    const form = find(tree, node => node.type === "form");
    assert.ok(form);
    return (form.props.onSubmit as (event: { preventDefault(): void }) => Promise<void>)({ preventDefault() {} });
  };
  return { render, submit };
}

for (const kind of ["Agreement", "Desire"]) {
  const path = `src/components/${kind}Vote.tsx`;

  test(`${kind}: rejected votes show an error, preserve inputs, and allow retry`, async () => {
    let calls = 0;
    const mounted = await mountVote(path, (async () => {
      calls++;
      return Response.json(calls === 1 ? { error: "你已经评价过这个地方了" } : { success: true }, { status: calls === 1 ? 409 : 200 });
    }) as typeof fetch);
    await mounted.submit(mounted.render());
    const failed = mounted.render();
    assert.ok(find(failed, node => node.props.role === "alert"), "HTTP errors must be visible instead of a success message");
    assert.equal(find(failed, node => node.type === "input" && node.props.value === "旅人")?.props.value, "旅人");
    assert.equal(find(failed, node => node.type === "button" && node.props.type === "submit")?.props.disabled, false);
    await mounted.submit(failed);
    const succeeded = mounted.render();
    assert.ok(find(succeeded, node => node.props.role === "status"));
    assert.equal(find(succeeded, node => node.type === "form"), undefined);
  });

  test(`${kind}: network failures release the submit button and do not report success`, async () => {
    const mounted = await mountVote(path, (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch);
    await assert.doesNotReject(mounted.submit(mounted.render()));
    const tree = mounted.render();
    assert.ok(find(tree, node => node.props.role === "alert"));
    assert.equal(find(tree, node => node.type === "button" && node.props.type === "submit")?.props.disabled, false);
    assert.equal(find(tree, node => node.props.role === "status"), undefined);
  });

  test(`${kind}: an unexpected response cannot be mistaken for a saved vote`, async () => {
    const mounted = await mountVote(path, (async () => new Response("upstream unavailable", { status: 502 })) as typeof fetch);
    await assert.doesNotReject(mounted.submit(mounted.render()));
    assert.ok(find(mounted.render(), node => node.props.role === "alert"));
  });

  test(`${kind}: a successful HTTP status without save confirmation does not show success`, async () => {
    const mounted = await mountVote(path, (async () => Response.json({})) as typeof fetch);
    await mounted.submit(mounted.render());
    const tree = mounted.render();
    assert.ok(find(tree, node => node.props.role === "alert"));
    assert.equal(find(tree, node => node.type === "button" && node.props.type === "submit")?.props.disabled, false);
  });

  test(`${kind}: only one request is sent while a vote is pending`, async () => {
    let calls = 0;
    let resolve!: (value: Response) => void;
    const mounted = await mountVote(path, (async () => {
      calls++;
      return new Promise<Response>(done => { resolve = done; });
    }) as typeof fetch);
    const tree = mounted.render();
    const pending = mounted.submit(tree);
    const duplicate = mounted.submit(tree);
    assert.equal(calls, 1);
    assert.equal(find(mounted.render(), node => node.type === "button" && node.props.type === "submit")?.props.disabled, true);
    resolve(Response.json({ success: true }));
    await Promise.all([pending, duplicate]);
    assert.ok(find(mounted.render(), node => node.props.role === "status"));
  });
}
