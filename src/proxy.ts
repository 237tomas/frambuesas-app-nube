import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, hasValidAdminSession } from "@/lib/admin-session";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (await hasValidAdminSession(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/clientes/:path*", "/compras/:path*", "/comprobantes/:path*"],
};
