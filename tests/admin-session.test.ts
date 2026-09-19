import assert from "node:assert/strict";
import { test } from "node:test";
import { createAdminSession, verifyAdminSession, verifyAdminPassword } from "../src/lib/admin-session.ts";

const password = "test-only-long-admin-password";
const secret = "test-only-independent-session-secret";
const now = 1_800_000_000;
const config = { password, secret };

test("only the correct non-empty password is accepted", () => {
  assert.equal(verifyAdminPassword(password, password), true);
  for (const value of [undefined, null, {}, [], "", "wrong"]) {
    assert.equal(verifyAdminPassword(value, password), false);
    assert.equal(verifyAdminPassword(value, undefined), false);
  }
  assert.equal(verifyAdminPassword("", ""), false);
});

test("a genuine session works until its server-enforced expiry", () => {
  const token = createAdminSession(config, now);
  assert.equal(verifyAdminSession(token, config, now), true);
  assert.equal(verifyAdminSession(token, config, now + 86_399), true);
  assert.equal(verifyAdminSession(token, config, now + 86_400), false);
});

test("a fresh genuine session remains valid when another server's clock is slightly behind", () => {
  const token = createAdminSession(config, now);
  assert.equal(verifyAdminSession(token, config, now - 30), true);
});

test("fixed cookies, malformed cookies and tampered sessions are rejected", () => {
  const token = createAdminSession(config, now);
  const parts = token.split(".");
  parts[1] = String(now + 86_399);
  const changedSignature = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  for (const value of [undefined, "authenticated", "", "a.b.c", token + ".extra", parts.join("."), changedSignature, token.slice(0, -10)]) {
    assert.equal(verifyAdminSession(value, config, now), false);
  }
});

test("changing either credential invalidates existing sessions", () => {
  const token = createAdminSession(config, now);
  assert.equal(verifyAdminSession(token, { ...config, password: "changed-password" }, now), false);
  assert.equal(verifyAdminSession(token, { ...config, secret: "changed-secret" }, now), false);
  assert.equal(verifyAdminSession(token, { secret }, now), false);
});

test("password-only configuration remains usable and missing configuration fails closed", () => {
  const token = createAdminSession({ password }, now);
  assert.equal(verifyAdminSession(token, { password }, now), true);
  assert.throws(() => createAdminSession({}, now));
  assert.throws(() => createAdminSession({ password: "" }, now));
  assert.notEqual(createAdminSession(config, now), createAdminSession(config, now));
});
