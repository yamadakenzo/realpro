import { NextResponse } from "next/server";
import { auth } from "@/auth";

// /api/staticmap は公開ページ（/estimate）の地図画像で未ログインの顧客も読むため除外する。
// このルートはサーバー側でAPIキーを使い、画像だけを返す（キーはクライアントに出ない）。
// /api/og は Instagram 投稿用画像（表紙など）を返すルート。画像だけを返し鍵は出さない（/api/staticmap と同じ扱い）。
const PUBLIC_PATHS = ["/login", "/estimate", "/compare", "/api/staticmap", "/api/og"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
