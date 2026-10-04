import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as labels from "../src/lib/types.ts";
const require = createRequire(import.meta.url);
test("ratings display only their original wording without added explanations or tooltips", async () => {
  const source = await readFile("src/components/RatingBadge.tsx", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} as { default: (props: { rating: number }) => React.ReactNode } };
  new Function("require", "module", "exports", compiled)((id: string) => id === "@/lib/types" ? labels : require(id), mod, mod.exports);
  for (const rating of [1, 2, 3, 4, 5]) {
    const html = renderToStaticMarkup(require("react").createElement(mod.exports.default, { rating }));
    assert.equal(html.replace(/<[^>]+>/g, ""), labels.RATING_LABELS[rating]);
    assert.ok(!html.includes("title="));
    assert.ok(!html.includes("<small"));
  }
});
