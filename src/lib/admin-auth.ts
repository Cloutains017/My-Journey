import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "./admin-session";
import { isTrustedAdminRequest } from "./admin-security";

export function adminSessionConfig() {
  return { password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET };
}

export async function checkAuth(request?: Request): Promise<boolean> {
  if (request && !isTrustedAdminRequest(request)) return false;
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value, adminSessionConfig());
}
