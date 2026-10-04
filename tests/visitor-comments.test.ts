import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { VOTE_COLORS } from "../src/components/voteStyles.ts";
import { AGREEMENT_LABELS, DESIRE_LABELS } from "../src/lib/types.ts";
import type { AgreementVote, DesireVote } from "../src/lib/types.ts";

const require = createRequire(import.meta.url);

async function renderVisitorComments(custom?: { agreementVotes: AgreementVote[]; desireVotes: DesireVote[] }): Promise<string> {
  const source = await readFile("src/components/VisitorComments.tsx", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} as { default?: (props: Record<string, unknown>) => React.ReactNode } };
  const localRequire = (id: string) => {
    if (id === "react/jsx-runtime") return require(id);
    if (id === "@/lib/types") return { AGREEMENT_LABELS, DESIRE_LABELS };
    if (id === "@/components/voteStyles") return { VOTE_COLORS };
    throw new Error(`Unexpected component dependency: ${id}`);
  };
  new Function("require", "module", "exports", compiled)(localRequire, compiledModule, compiledModule.exports);
  assert.ok(compiledModule.exports.default, "访客回声组件应有默认导出");

  const createdAt = "2026-09-20T00:00:00.000Z";
  const agreementVotes = [1, 2, 3, 4, 5].map((agreement) => ({
    id: `agreement-${agreement}`,
    trip_id: "trip-1",
    nickname: `认可${agreement}`,
    agreement,
    comment: null,
    created_at: createdAt,
  }));
  const desireVotes = [1, 2, 3, 4, 5].map((desire_level) => ({
    id: `desire-${desire_level}`,
    trip_id: "trip-1",
    nickname: `心动${desire_level}`,
    desire_level,
    comment: null,
    created_at: createdAt,
  }));
  return renderToStaticMarkup(
    require("react").createElement(compiledModule.exports.default, custom || { agreementVotes, desireVotes }),
  );
}

function labelClass(html: string, label: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<span class="([^"]*)">(?:✓ |🔥 )?${escapedLabel}</span>`));
  assert.ok(match, `访客回声应展示“${label}”`);
  return match[1];
}

test("访客回声按每条投票的档位显示不同颜色", async () => {
  const html = await renderVisitorComments();
  const baseClass = "text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0 font-sans";

  for (const level of [1, 2, 3, 4, 5]) {
    const expectedClass = `${baseClass} ${VOTE_COLORS[level]}`;
    assert.equal(labelClass(html, AGREEMENT_LABELS[level]), expectedClass, `认可度第 ${level} 档应使用对应颜色`);
    assert.equal(labelClass(html, DESIRE_LABELS[level]), expectedClass, `心动指数第 ${level} 档应使用对应颜色`);
  }
});

test("访客回声的评级标签不显示类型图标", async () => {
  const html = await renderVisitorComments();

  assert.equal(html.includes("✓ "), false);
  assert.equal(html.includes("🔥 "), false);
});

test("共享昵称的两种评价并排展示，同一条留言只出现一次", async () => {
  const row = { id: "a", trip_id: "trip-1", nickname: "同一旅人", comment: "共同留言", created_at: "2026-10-04T12:00:00Z" };
  const html = await renderVisitorComments({ agreementVotes: [{ ...row, agreement: 2 }], desireVotes: [{ ...row, id: "d", desire_level: 1 }] });
  assert.equal(html.split("同一旅人").length - 1, 1);
  assert.equal(html.split("共同留言").length - 1, 1);
  assert.ok(html.includes("认同")); assert.ok(html.includes("心驰神往"));
});

test("旧评价的不同留言保留，单独的评价仍正常展示", async () => {
  const row = { id: "a", trip_id: "trip-1", nickname: "旅人", created_at: "2026-10-04T12:00:00Z" };
  const html = await renderVisitorComments({ agreementVotes: [{ ...row, agreement: 2, comment: "认可留言" }], desireVotes: [{ ...row, id: "d", desire_level: 1, comment: "心动留言" }, { ...row, id: "other", nickname: "另一位旅人", desire_level: 3, comment: "单独留言" }] });
  for (const message of ["认可留言", "心动留言", "单独留言", "另一位旅人"]) assert.ok(html.includes(message));
});
