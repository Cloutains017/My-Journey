import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
import * as labels from "../src/lib/types.ts";
import * as colors from "../src/components/voteStyles.ts";

const require = createRequire(import.meta.url);
type Element = { type: unknown; props: Record<string, unknown> };
function findAll(node: unknown, predicate: (node: Element) => boolean): Element[] {
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, predicate));
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const el = node as Element;
  return [...(predicate(el) ? [el] : []), ...findAll(el.props.children, predicate)];
}
async function mount(request: typeof fetch) {
  const source = await readFile("src/components/TripFeedback.tsx", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const states: unknown[] = []; const refs: { current: unknown }[] = [];
  let cursor = 0; let refCursor = 0;
  const react = { ...require("react"), useState(initial: unknown) {
    const index = cursor++;
    if (index >= states.length) states[index] = initial;
    return [states[index], (next: unknown) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
  }, useRef(initial: unknown) { return refs[refCursor++] ??= { current: initial }; } };
  const mod = { exports: {} as { default: (props: { tripId: string; rating: number }) => unknown } };
  new Function("require", "module", "exports", "fetch", compiled)((id: string) => {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return require(id);
    if (id === "@/lib/types") return labels;
    if (id === "@/components/voteStyles") return colors;
    throw Error(id);
  }, mod, mod.exports, request);
  const render = () => { cursor = refCursor = 0; return mod.exports.default({ tripId: "trip-1", rating: 4 }); };
  const get = (predicate: (node: Element) => boolean) => { const found = findAll(render(), predicate)[0]; assert.ok(found); return found; };
  const click = (label: string) => (get(el => el.type === "button" && el.props.children === label).props.onClick as () => void)();
  const fill = (label: string, value: string) => (get(el => el.props["aria-label"] === label).props.onChange as (e: unknown) => void)({ target: { value } });
  const submit = () => (get(el => el.type === "form").props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
  return { render, get, click, fill, submit };
}
test("one form shares nickname and reveals one optional comment after selecting a rating", async () => {
  const mounted = await mount(fetch);
  assert.equal(findAll(mounted.render(), el => el.type === "form").length, 1);
  assert.equal(findAll(mounted.render(), el => el.type === "input").length, 1);
  assert.equal(findAll(mounted.render(), el => el.type === "textarea").length, 0);
  mounted.click("认同");
  assert.equal(findAll(mounted.render(), el => el.type === "textarea").length, 1);
  mounted.click("颇为向往");
  assert.equal(findAll(mounted.render(), el => el.type === "textarea").length, 1);
});
test("both choices use the same trimmed nickname/comment and confirmation waits for both responses", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const mounted = await mount((async (url, options) => { calls.push({ url: String(url), body: JSON.parse(String(options?.body)) }); return Response.json({ success: true }); }) as typeof fetch);
  mounted.click("认同"); mounted.click("颇为向往"); mounted.fill("你的昵称", " 旅人 "); mounted.fill("留言（可选）", " 风景很好 ");
  await mounted.submit();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(c => [c.body.nickname, c.body.comment]), [["旅人", "风景很好"], ["旅人", "风景很好"]]);
  assert.equal(calls.find(c => c.url.endsWith("agreement"))?.body.agreement, 2);
  assert.equal(calls.find(c => c.url.endsWith("desire"))?.body.desireLevel, 2);
  assert.equal(findAll(mounted.render(), el => el.type === "form").length, 0);
  assert.equal(findAll(mounted.render(), el => el.props.role === "status").length, 1);
});
test("a single selected rating can be sent without requiring the other or a comment", async () => {
  const calls: string[] = [];
  const mounted = await mount((async (url, options) => { calls.push(String(url)); assert.equal(JSON.parse(String(options?.body)).comment, null); return Response.json({ success: true }); }) as typeof fetch);
  mounted.click("尚在考虑"); mounted.fill("你的昵称", "旅人"); await mounted.submit();
  assert.deepEqual(calls, ["/api/votes/desire"]);
});
test("partial failure preserves the draft and retries only the unsaved choice", async () => {
  const calls: string[] = [];
  const mounted = await mount((async url => { calls.push(String(url)); return String(url).endsWith("desire") && calls.length < 3 ? Response.json({ error: "稍后再试" }, { status: 500 }) : Response.json({ success: true }); }) as typeof fetch);
  mounted.click("认同"); mounted.click("颇为向往"); mounted.fill("你的昵称", "旅人"); mounted.fill("留言（可选）", "保留内容"); await mounted.submit();
  assert.ok(findAll(mounted.render(), el => el.props.role === "alert").length);
  assert.equal(mounted.get(el => el.type === "textarea").props.value, "保留内容");
  assert.equal(mounted.get(el => el.type === "input").props.disabled, true);
  await mounted.submit();
  assert.deepEqual(calls, ["/api/votes/agreement", "/api/votes/desire", "/api/votes/desire"]);
  assert.equal(findAll(mounted.render(), el => el.type === "form").length, 0);
});
for (const failure of ["network", "non-json", "unconfirmed", "conflict"]) test(`${failure} cannot be presented as a saved feeling`, async () => {
  const mounted = await mount((async () => {
    if (failure === "network") throw new TypeError("Failed to fetch");
    if (failure === "non-json") return new Response("unavailable", { status: 502 });
    if (failure === "conflict") return Response.json({ error: "你已经评价过这个地方了" }, { status: 409 });
    return Response.json({});
  }) as typeof fetch);
  mounted.click("认同"); mounted.fill("你的昵称", "旅人"); await mounted.submit();
  assert.ok(findAll(mounted.render(), el => el.props.role === "alert").length);
  assert.equal(mounted.get(el => el.type === "button" && el.props.type === "submit").props.disabled, false);
  assert.equal(findAll(mounted.render(), el => el.type === "form").length, 1);
});
test("repeated submits while pending send each selected choice only once", async () => {
  const resolvers: ((response: Response) => void)[] = [];
  const mounted = await mount((async () => new Promise<Response>(resolve => resolvers.push(resolve))) as typeof fetch);
  mounted.click("认同"); mounted.click("颇为向往"); mounted.fill("你的昵称", "旅人");
  const pending = mounted.submit(); const duplicate = mounted.submit();
  assert.equal(resolvers.length, 2);
  assert.equal(mounted.get(el => el.type === "button" && el.props.type === "submit").props.disabled, true);
  resolvers.forEach(resolve => resolve(Response.json({ success: true })));
  await Promise.all([pending, duplicate]);
  assert.equal(findAll(mounted.render(), el => el.type === "form").length, 0);
});

test("an existing second vote does not trap a partially saved form", async () => {
  const mounted = await mount((async url => String(url).endsWith("desire")
    ? Response.json({ error: "你已经表达过想去程度了" }, { status: 409 }) : Response.json({ success: true })) as typeof fetch);
  mounted.click("认同"); mounted.click("颇为向往"); mounted.fill("你的昵称", "旅人"); await mounted.submit();
  mounted.click("仅保留已保存的评价");
  assert.equal(findAll(mounted.render(), el => el.type === "form").length, 0);
  const status = mounted.get(el => el.props.role === "status");
  const text = JSON.stringify(status);
  assert.ok(text.includes("认可度：认同")); assert.ok(!text.includes("心动指数："));
});
