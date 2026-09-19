import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionConfig } from "@/lib/admin-auth";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminSession, verifyAdminPassword } from "@/lib/admin-session";

export async function POST(request: Request) {
  const config = adminSessionConfig();
  if (!config.password) {
    return NextResponse.json({ error: "管理后台尚未配置密码" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const password = body && typeof body === "object" && "password" in body ? body.password : undefined;
  if (verifyAdminPassword(password, config.password)) {
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE, createAdminSession(config), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_SECONDS,
    });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "密码错误" }, { status: 401 });
}
