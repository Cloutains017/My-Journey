import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { ACTIVE_VOTE_COLORS, VOTE_COLORS } from "../src/components/voteStyles.ts";
import { AGREEMENT_LABELS, DESIRE_LABELS } from "../src/lib/types.ts";

const require = createRequire(import.meta.url);

async function renderVote(
  componentPath: string,
  labels: Record<number, string>,
  selected: number | null,
): Promise<string> {
  const source = await readFile(componentPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const realReact = require("react");
  let stateIndex = 0;
  const reactWithInitialVote = {
    ...realReact,
    useState(initial: unknown) {
      const value = stateIndex++ === 0 ? selected : initial;
      return [value, () => undefined];
    },
  };
  const compiledModule = { exports: {} as { default?: (props: { tripId: string }) => React.ReactNode } };
  const localRequire = (id: string) => {
    if (id === "react") return reactWithInitialVote;
    if (id === "react/jsx-runtime") return require(id);
    if (id === "@/lib/types") return { AGREEMENT_LABELS: labels, DESIRE_LABELS: labels };
    if (id === "@/components/voteStyles") return { ACTIVE_VOTE_COLORS, VOTE_COLORS };
    throw new Error(`Unexpected component dependency: ${id}`);
  };
  new Function("require", "module", "exports", compiled)(localRequire, compiledModule, compiledModule.exports);
  assert.ok(compiledModule.exports.default, `组件 ${componentPath} 应有默认导出`);
  return renderToStaticMarkup(realReact.createElement(compiledModule.exports.default, { tripId: "trip-1" }));
}

function buttonClass(html: string, label: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<button[^>]*class="([^"]*)"[^>]*>${escapedLabel}</button>`));
  assert.ok(match, `页面应包含“${label}”按钮`);
  return match[1];
}

test("心动指数按由强到弱的顺序展示文雅评级", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((value) => DESIRE_LABELS[value]),
    ["心驰神往", "颇为向往", "尚在考虑", "兴致平平", "永不踏足"],
  );
});

test("心动指数与认可度的五档按钮在普通和选中状态下逐项同色", async () => {
  const pairs = [
    ["心驰神往", "非常认同"],
    ["颇为向往", "认同"],
    ["尚在考虑", "一般"],
    ["兴致平平", "不认同"],
    ["永不踏足", "非常不认同"],
  ];

  for (const selected of [null, 1, 2, 3, 4, 5]) {
    const desireHtml = await renderVote("src/components/DesireVote.tsx", DESIRE_LABELS, selected);
    const agreementHtml = await renderVote("src/components/AgreementVote.tsx", AGREEMENT_LABELS, selected);
    for (const [desireLabel, agreementLabel] of pairs) {
      assert.equal(
        buttonClass(desireHtml, desireLabel),
        buttonClass(agreementHtml, agreementLabel),
        `${desireLabel} 应与 ${agreementLabel} 在选择 ${selected ?? "无"} 时同色`,
      );
    }
  }
});
