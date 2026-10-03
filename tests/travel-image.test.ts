import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
import { photoVariantUrl } from "../src/lib/photo-variants.ts";

const require = createRequire(import.meta.url);
const base = "https://photos.example.com";
const original = `${base}/00000000-0000-0000-0000-000000000001/photo.jpg`;
type ImageElement = { props: Record<string, unknown> & { onLoad(event: unknown): void; onError(event: unknown): void } };

async function mountImage() {
  const compiled = ts.transpileModule(await readFile("src/components/TravelImage.tsx", "utf8"), { compilerOptions: {
    esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  let cursor = 0;
  const states: unknown[] = [];
  let errors = 0;
  let loads = 0;
  const react = { ...require("react"), useState(initial: unknown) {
    const i = cursor++;
    if (i >= states.length) states[i] = initial;
    return [states[i], (next: unknown) => { states[i] = next; }];
  } };
  const compiledModule = { exports: {} as { default(props: Record<string, unknown>): ImageElement } };
  new Function("require", "module", "exports", "process", compiled)((id: string) => {
    if (id === "react") return react;
    if (id === "next/image") return { default: "img" };
    if (id === "@/lib/photo-variants") return { photoVariantUrl };
    return require(id);
  }, compiledModule, compiledModule.exports, { env: { NEXT_PUBLIC_PHOTO_BASE_URL: base } });
  const render = (src = original) => {
    cursor = 0;
    return compiledModule.exports.default({ src, alt: "山水", className: "cover", onError: () => { errors++; }, onLoad: () => { loads++; } });
  };
  return { render, errors: () => errors, loads: () => loads };
}

test("an unavailable thumbnail falls back to its original before reporting an image failure", async () => {
  const image = await mountImage();
  assert.equal(image.render().props.src, `${original}.thumb.webp`);
  image.render().props.onError({});
  assert.equal(image.render().props.src, original);
  assert.equal(image.errors(), 0);
  image.render().props.onLoad({});
  assert.equal(image.loads(), 1);
  assert.equal(image.render().props["data-image-state"], "ready");
});

test("an original failure stays visible and reports the terminal error once", async () => {
  const image = await mountImage();
  image.render().props.onError({});
  image.render().props.onError({});
  image.render().props.onError({});
  assert.equal(image.errors(), 1);
  assert.equal(image.render().props["data-image-state"], "error");
});

test("changing a loaded photo resets its loading presentation without losing alt text", async () => {
  const image = await mountImage();
  image.render().props.onLoad({});
  assert.equal(image.render().props["data-image-state"], "ready");
  const changed = image.render(`${base}/00000000-0000-0000-0000-000000000001/other.jpg`);
  assert.equal(changed.props["data-image-state"], "loading");
  assert.equal(changed.props.alt, "山水");
  assert.ok(String(changed.props.className).includes("cover"));
});
