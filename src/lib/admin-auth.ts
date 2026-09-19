import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "./admin-session";

export function adminSessionConfig() {
  return { password: process.env.ADMIN_PASSWORD, secret: process.env.ADMIN_SESSION_SECRET };
}

export async function checkAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value, adminSessionConfig());
}
