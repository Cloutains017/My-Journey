import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { RATING_LABELS, RATING_DESCRIPTIONS } from "../src/lib/types.ts";
const require = createRequire(import.meta.url);
test("ratings keep their original wording and can explain their first appearance without a hover", async () => {
  const source = await readFile("src/components/RatingBadge.tsx", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} as { default: (props: { rating: number; explain?: boolean }) => React.ReactNode } };
  new Function("require", "module", "exports", compiled)((id: string) => id === "@/lib/types" ? { RATING_LABELS, RATING_DESCRIPTIONS } : require(id), mod, mod.exports);
  for (const rating of [1, 2, 3, 4, 5]) {
    const html = renderToStaticMarkup(require("react").createElement(mod.exports.default, { rating, explain: true }));
    assert.ok(html.includes(`>${RATING_LABELS[rating]}</span>`));
    assert.ok(html.includes(`<small class="rating-explanation">${RATING_DESCRIPTIONS[rating]}</small>`));
  }
  const compact = renderToStaticMarkup(require("react").createElement(mod.exports.default, { rating: 4 }));
  assert.ok(!compact.includes("<small"));
});
