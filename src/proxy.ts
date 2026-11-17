import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { contentSecurityPolicy } from "./lib/security-headers";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(18).toString("base64");
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV !== "production",
  );
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|images/|icon.svg|favicon.ico|manifest.webmanifest|robots.txt).*)",
  ],
};
