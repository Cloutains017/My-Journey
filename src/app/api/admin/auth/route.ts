import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionConfig } from "@/lib/admin-auth";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminSession, verifyAdminPassword } from "@/lib/admin-session";
import { isTrustedAdminRequest, loginSource } from "@/lib/admin-security";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  if (!isTrustedAdminRequest(request)) return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  const config = adminSessionConfig();
  if (!config.password) {
    return NextResponse.json({ error: "管理后台尚未配置密码" }, { status: 503 });
  }
  const source = loginSource(request, config.secret || config.password, process.env.VERCEL === "1");
  const { data: allowed, error: limitError } = await supabaseAdmin.rpc("admin_login_attempt", { source_key: source });
  if (limitError) return NextResponse.json({ error: "安全检查暂不可用，请稍后重试" }, { status: 503 });
  if (allowed !== true) return NextResponse.json({ error: "登录尝试过于频繁，请 15 分钟后再试" }, { status: 429, headers: { "Retry-After": "900" } });
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) return NextResponse.json({ error: "请求过大" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const password = body && typeof body === "object" && "password" in body ? body.password : undefined;
  const valid = verifyAdminPassword(password, config.password);
  const { error: auditError } = await supabaseAdmin.from("admin_audit_log").insert({ action: valid ? "LOGIN_SUCCESS" : "LOGIN_FAILURE", target: "admin", actor: source });
  if (auditError) return NextResponse.json({ error: "安全记录暂不可用，请稍后重试" }, { status: 503 });
  if (valid) {
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

export async function DELETE(request: Request) {
  if (!isTrustedAdminRequest(request)) return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  (await cookies()).set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return NextResponse.json({ success: true });
}
