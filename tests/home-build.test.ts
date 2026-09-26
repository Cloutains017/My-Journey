import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("production build succeeds when Supabase is unavailable at build time", () => {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm run build"] : ["run", "build"];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "build-test-key",
      SUPABASE_SERVICE_ROLE_KEY: "build-test-key",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });

  assert.equal(
    result.status,
    0,
    `production build must not depend on Supabase during prerendering\n${result.error?.message || ""}\n${result.stdout || ""}\n${result.stderr || ""}`,
  );
});
