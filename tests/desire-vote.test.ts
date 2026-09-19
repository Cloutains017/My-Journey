import test from "node:test";
import assert from "node:assert/strict";
import { DESIRE_LABELS } from "../src/lib/types.ts";

test("心动指数按由强到弱的顺序展示文雅评级", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((value) => DESIRE_LABELS[value]),
    ["心驰神往", "颇为向往", "尚在考虑", "兴致平平", "永不踏足"],
  );
});
