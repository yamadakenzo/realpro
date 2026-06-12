import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next/og（ImageResponse）で使う日本語フォント(.otf 約9MB)を、本番（Vercel）のサーバー関数に確実に同梱する。
  // フォントは src/app/api/og/cover/fonts/ に置き、画像系4ルート（_shared 経由）が fs で読み込む。
  // new URL(import.meta.url) だけでは本番のファイルトレースから漏れることがあるため、明示的に含める。
  outputFileTracingIncludes: {
    "/api/og/cover": ["./src/app/api/og/cover/fonts/**"],
    "/api/og/floorplan": ["./src/app/api/og/cover/fonts/**"],
    "/api/og/spec": ["./src/app/api/og/cover/fonts/**"],
    "/api/og/cta": ["./src/app/api/og/cover/fonts/**"],
  },
};

export default nextConfig;
