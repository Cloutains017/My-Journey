import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { createAdminSession } from "../src/lib/admin-session.ts";

const base = process.env.ADMIN_TEST_BASE_URL;
if (base && !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
  throw new Error("Integration tests must target a local server");
}
if (base) config({ path: ".env.local", quiet: true });
const options = { skip: !base };
const id = "00000000-0000-0000-0000-000000000000";

test("every admin data route rejects the legacy forged cookie before processing a request", options, async () => {
  const routes = [
    ["GET", "/trips"], ["POST", "/trips"], ["PUT", `/trips/${id}`], ["DELETE", `/trips/${id}`],
    ["GET", "/votes"], ["DELETE", `/votes/agreement/${id}`], ["DELETE", `/votes/desire/${id}`],
    ["POST", "/photos"], ["POST", "/photos/presign"], ["POST", "/photos/register"],
    ["DELETE", `/photos/${id}`], ["POST", "/city-boundary"],
  ];
  for (const [method, path] of routes) {
    const res = await fetch(`${base}/api/admin${path}`, {
      method,
      headers: { Cookie: "admin_token=authenticated", "Content-Type": "application/json" },
      ...(method === "POST" || method === "PUT" ? { body: "{}" } : {}),
    });
    assert.equal(res.status, 401, `${method} ${path} must reject forged cookies`);
  }
});

test("login rejects malformed and missing passwords and permits a genuine session", options, async () => {
  for (const [body, status] of [["{", 400], ["{}", 401], ["null", 401], ['{"password":123}', 401]] as const) {
    const res = await fetch(`${base}/api/admin/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.equal(res.status, status);
    assert.equal(res.headers.has("set-cookie"), false);
  }
  const login = await fetch(`${base}/api/admin/auth`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie") || "";
  assert.equal(cookie.includes("HttpOnly"), true);
  assert.equal(cookie.toLowerCase().includes("samesite=strict"), true);
  const res = await fetch(`${base}/api/admin/trips`, { headers: { Cookie: cookie.split(";")[0] } });
  assert.equal(res.status, 200);
  assert.equal(Array.isArray(await res.json()), true);
});

test("missing and expired sessions are rejected by the running server", options, async () => {
  const res = await fetch(`${base}/api/admin/trips`);
  assert.equal(res.status, 401);
  const expired = createAdminSession({ password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET }, Math.floor(Date.now() / 1000) - 86_401);
  const expiredRes = await fetch(`${base}/api/admin/trips`, { headers: { Cookie: `admin_token=${expired}` } });
  assert.equal(expiredRes.status, 401);
});
