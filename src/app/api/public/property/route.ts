import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sourceLetter, pad3 } from "@/app/api/og/_postnumber";

// housing-jp（別ドメイン）の管理画面から「番号（例 T-021）で物件を引く」ための公開API.
// ★方針（2026-06-13 決定）：
//   - 簡易キー必須：環境変数 REALPRO_LOOKUP_KEY と一致する key を要求（ヘッダー x-api-key か ?key=）。
//     未設定なら 500（誤って全開放しないようフェイルクローズ）。不一致なら 401。
//   - CORS不要：housing-jp の「サーバー側」から叩く前提（ブラウザ直叩きしない）のでCORSヘッダーは付けない。
//   - 認証除外：proxy.ts の PUBLIC_PATHS に /api/public を追加済み（NextAuthセッション無しで到達できる）。
//   - 返す情報は /estimate/[slug]（既に完全公開）と同じ範囲。新たな秘密は増やさない。
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

function getBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const origin = request.nextUrl.origin;
  if (origin) return origin;
  return "https://realpro-one.vercel.app";
}

// "t-021" や " T-021 " を "T-021" に正規化（前後空白除去・英字大文字化）
function normalizeNumber(s: string): string {
  return s.trim().toUpperCase();
}

export async function GET(request: NextRequest) {
  // 1. 簡易キーの検証
  const expectedKey = process.env.REALPRO_LOOKUP_KEY;
  if (!expectedKey) {
    console.error("[/api/public/property] REALPRO_LOOKUP_KEY が未設定です");
    return Response.json({ error: "サーバー設定エラー（キー未設定）" }, { status: 500 });
  }
  const providedKey =
    request.headers.get("x-api-key") || request.nextUrl.searchParams.get("key") || "";
  if (providedKey !== expectedKey) {
    return Response.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  // 2. 番号パラメータ
  const raw = request.nextUrl.searchParams.get("number");
  if (!raw || !raw.trim()) {
    return Response.json({ error: "number が必要です（例 ?number=T-021）" }, { status: 400 });
  }
  const wanted = normalizeNumber(raw);

  // 3. 全行を取得して番号を確定（一覧 /api/estimates・採番 _postnumber と同じ並び）
  const client = getSupabaseAdmin() ?? supabase;
  const { data, error } = await client
    .from("estimates")
    .select("slug, data, created_at, expires_at");
  if (error || !data) {
    console.error("[/api/public/property] 取得失敗", error);
    return Response.json({ error: "物件の取得に失敗しました" }, { status: 500 });
  }

  const rows = data as Row[];
  // created_at 昇順（同時刻は slug 昇順）で通し順位を確定（保存番号が無い物件の暫定番号に使う）
  const ranked = rows
    .map((r) => ({
      slug: r.slug,
      createdAt: r.created_at ?? "",
      expiresAt: r.expires_at,
      extracted: r.data?.result?.extracted,
      savedNumber: r.data?.igPost?.number,
    }))
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    })
    .map((r, i) => ({
      ...r,
      number: r.savedNumber || `${sourceLetter(r.extracted?.source)}-${pad3(i + 1)}`,
    }));

  const hit = ranked.find((r) => normalizeNumber(r.number) === wanted);
  if (!hit) {
    return Response.json({ error: "その番号の物件は見つかりません", number: wanted }, { status: 404 });
  }
  // 論理削除（期限切れ）は見つからない扱い
  if (hit.expiresAt && new Date(hit.expiresAt) < new Date()) {
    return Response.json({ error: "その番号の物件は見つかりません", number: wanted }, { status: 404 });
  }

  const ex = hit.extracted ?? {};
  const rentTotal = (ex.rent ?? 0) + (ex.managementFee ?? 0);

  return Response.json({
    number: hit.number,
    propertyName: ex.propertyName ?? "",
    address: ex.address ?? "",
    rentTotal, // 賃料（家賃＋管理費の総額）
    floorPlan: ex.floorPlan ?? "",
    slug: hit.slug,
    shareUrl: `${getBaseUrl(request)}/estimate/${hit.slug}`,
  });
}
