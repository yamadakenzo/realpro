import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// housing-jp（別ドメイン）の管理画面「投稿管理」タブで「直近の投稿N件」を一覧表示するための公開API.
// ★方針（2026-06-14 決定）：
//   - 既存の番号照会API（/api/public/property）と同じ認証・同じ返却項目で、配列を返すだけの兄弟ルート。
//   - 簡易キー必須：環境変数 REALPRO_LOOKUP_KEY と一致する key を要求（ヘッダー x-api-key か ?key=）。
//     未設定なら 500（フェイルクローズ）。不一致なら 401。
//   - 一覧に出すのは「投稿として番号を振った物件」のみ：data.igPost.number が保存済みのもの。
//     未採番（ただの見積もり下書き）と論理削除（expires_at 経過）は一覧から除外する。
//   - 並びは created_at の新しい順（同時刻は slug で安定化）。最大 limit 件（デフォルト20）。
//   - 返す情報は /api/public/property の1件照会と同じ範囲（新たな秘密は増やさない）。
//   - 既存の番号照会API・/compare・/estimate などは一切触らない（無改修）。
export const dynamic = "force-dynamic";

type Extracted = {
  propertyName?: string;
  address?: string;
  roomNumber?: string;
  floorPlan?: string;
  rent?: number;
  managementFee?: number;
  source?: string;
};

type EstimateData = {
  result?: { extracted?: Extracted };
  igPost?: { number?: string };
};

type Row = {
  slug: string;
  data: EstimateData | null;
  created_at: string | null;
  expires_at: string | null;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function getBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const origin = request.nextUrl.origin;
  if (origin) return origin;
  return "https://realpro-one.vercel.app";
}

// ?limit= を 1〜MAX_LIMIT にクランプ。未指定・不正は DEFAULT_LIMIT。
function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

export async function GET(request: NextRequest) {
  // 1. 簡易キーの検証（番号照会APIと同一）
  const expectedKey = process.env.REALPRO_LOOKUP_KEY;
  if (!expectedKey) {
    console.error("[/api/public/properties/recent] REALPRO_LOOKUP_KEY が未設定です");
    return Response.json({ error: "サーバー設定エラー（キー未設定）" }, { status: 500 });
  }
  const providedKey =
    request.headers.get("x-api-key") || request.nextUrl.searchParams.get("key") || "";
  if (providedKey !== expectedKey) {
    return Response.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  // 2. limit
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  // 3. 全行を取得
  const client = getSupabaseAdmin() ?? supabase;
  const { data, error } = await client
    .from("estimates")
    .select("slug, data, created_at, expires_at");
  if (error || !data) {
    console.error("[/api/public/properties/recent] 取得失敗", error);
    return Response.json({ error: "物件の取得に失敗しました" }, { status: 500 });
  }

  const baseUrl = getBaseUrl(request);
  const now = new Date();
  const rows = data as Row[];

  const properties = rows
    // 番号未割り当て（ただの下書き）は除外
    .filter((r) => !!r.data?.igPost?.number)
    // 論理削除（期限切れ）は除外
    .filter((r) => !r.expires_at || new Date(r.expires_at) >= now)
    // created_at の新しい順（同時刻は slug 昇順で安定化）
    .sort((a, b) => {
      const ca = a.created_at ?? "";
      const cb = b.created_at ?? "";
      if (ca !== cb) return ca < cb ? 1 : -1;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    })
    .slice(0, limit)
    .map((r) => {
      const ex = r.data?.result?.extracted ?? {};
      const rentTotal = (ex.rent ?? 0) + (ex.managementFee ?? 0);
      return {
        number: r.data?.igPost?.number ?? "",
        propertyName: ex.propertyName ?? "",
        address: ex.address ?? "",
        rentTotal, // 賃料（家賃＋管理費の総額）
        floorPlan: ex.floorPlan ?? "",
        slug: r.slug,
        shareUrl: `${baseUrl}/estimate/${r.slug}`,
      };
    });

  return Response.json({ properties });
}
