import assert from "node:assert/strict";
import { test } from "node:test";
import { groupTripPhotos, validatePhotoGroups } from "../src/lib/photo-groups.ts";
import type { Photo } from "../src/lib/types.ts";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const c = "33333333-3333-4333-8333-333333333333";
const photo = (id: string) => ({ id, created_at: id }) as Photo;

test("photo groups preserve group and photo order, then show unassigned photos", () => {
  const groups = [
    { id: a, title: "山路", photoIds: [c, a] },
    { id: b, title: "日落", photoIds: [b] },
  ];
  const result = groupTripPhotos([photo(a), photo(b), photo(c), photo("other")], groups);
  assert.deepEqual(result.map(group => [group.title, group.photos.map(item => item.id)]), [
    ["山路", [c, a]], ["日落", [b]], ["未分组", ["other"]],
  ]);
});

test("old trips and missing photos keep a usable gallery", () => {
  assert.deepEqual(groupTripPhotos([photo(a)], null).map(group => group.photos.map(item => item.id)), [[a]]);
  assert.deepEqual(groupTripPhotos([photo(a)], [{ id: b, title: "山路", photoIds: [c] }]).map(group => group.photos.map(item => item.id)), [[a]]);
});

test("validation rejects duplicate and foreign photo references", () => {
  assert.deepEqual(validatePhotoGroups([{ id: a, title: "山路", photoIds: [b] }], new Set([b])), [{ id: a, title: "山路", photoIds: [b] }]);
  assert.throws(() => validatePhotoGroups([{ id: a, title: "山路", photoIds: [c] }], new Set([b])), /不属于/);
  assert.throws(() => validatePhotoGroups([
    { id: a, title: "山路", photoIds: [b] },
    { id: c, title: "日落", photoIds: [b] },
  ], new Set([b])), /重复/);
});
