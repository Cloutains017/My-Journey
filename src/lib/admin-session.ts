import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "admin_token";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 24;

type SessionConfig = { password?: string; secret?: string };

export function verifyAdminPassword(input: unknown, expected: string | undefined): boolean {
  if (typeof input !== "string" || !input || !expected) return false;
  return timingSafeEqual(
    createHash("sha256").update(input).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

function signingKey(config: SessionConfig): Buffer {
  if (!config.password) throw new Error("ADMIN_PASSWORD must be configured");
  // Bind sessions to the password too, so changing it revokes old sessions.
  return createHmac("sha256", config.secret || config.password)
    .update(`my-journey:admin-session:${config.password}`).digest();
}

export function createAdminSession(config: SessionConfig, now = Math.floor(Date.now() / 1000)): string {
  const payload = `v1.${now + ADMIN_SESSION_SECONDS}.${randomBytes(24).toString("hex")}`;
  const signature = createHmac("sha256", signingKey(config)).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyAdminSession(token: string | undefined, config: SessionConfig, now = Math.floor(Date.now() / 1000)): boolean {
  if (!token || !config.password) return false;
  const match = /^(v1\.(\d{10})\.[a-f0-9]{48})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const expiry = Number(match[2]);
  // The signature protects expiry; an upper bound would reject sessions from
  // another instance whose clock is slightly ahead of this one.
  if (expiry <= now) return false;
  const expected = createHmac("sha256", signingKey(config)).update(match[1]).digest();
  return timingSafeEqual(expected, Buffer.from(match[3], "hex"));
}
