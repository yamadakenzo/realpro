import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sourceLetter, pad3 } from "@/app/api/og/_postnumber";

const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SLUG_LENGTH = 8;
const MAX_SLUG_ATTEMPTS = 5;

// Instagram 投稿UI（/instagram）用：保存済み見積もりの一覧を返す。
// 認証必須ルート（middleware で保護）。投稿番号も order(=og側と同じ created_at 通し順位)で算出して付ける。
type EstimateListRow = {
  slug: string;
  data: {
    result?: { extracted?: { propertyName?: string; address?: string; roomNumber?: string; source?: string } };
    igPost?: { number?: string };
  } | null;
  created_at: string | null;
  expires_at: string | null;
};

export async function GET() {
  try {
    const client = getSupabaseAdmin() ?? supabase;
    const { data, error } = await client
      .from("estimates")
      .select("slug, data, created_at, expires_at");
    if (error || !data) {
      return Response.json({ estimates: [] });
    }

    const rows = data as EstimateListRow[];
    // og 側の採番と一致させるため、全行を created_at（同時刻は slug）昇順で並べて通し順位 = seq
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
        slug: r.slug,
        // 保存済み番号があればそれを表示。無ければ決定論の順位で暫定表示（初回生成時に確定・保存される）
        number: r.savedNumber || `${sourceLetter(r.extracted?.source)}-${pad3(i + 1)}`,
        propertyName: r.extracted?.propertyName ?? "",
        address: r.extracted?.address ?? "",
        roomNumber: r.extracted?.roomNumber ?? "",
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      }));

    // 表示は期限切れを除き、新しい順で最大100件
    const now = new Date();
    const estimates = ranked
      .filter((r) => !r.expiresAt || new Date(r.expiresAt) >= now)
      .filter((r) => r.propertyName || r.address)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .slice(0, 100);

    return Response.json({ estimates });
  } catch (err) {
    console.error("[/api/estimates GET]", err);
    return Response.json({ estimates: [] });
  }
}

function generateSlug(): string {
  let s = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return s;
}

function getBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const origin = request.nextUrl.origin;
  if (origin) return origin;
  return "https://realpro-one.vercel.app";
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    if (!data || typeof data !== "object") {
      return Response.json({ error: "見積もりデータが不正です" }, { status: 400 });
    }

    let slug = "";
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const candidate = generateSlug();
      const { error } = await supabase
        .from("estimates")
        .insert({ slug: candidate, data });
      if (!error) {
        slug = candidate;
        break;
      }
      lastError = error;
      // 23505 = unique_violation → 再試行
      if (error.code !== "23505") break;
    }

    if (!slug) {
      console.error("[/api/estimates] insert failed", lastError);
      return Response.json({ error: "見積もりの保存に失敗しました" }, { status: 500 });
    }

    const url = `${getBaseUrl(request)}/estimate/${slug}`;
    return Response.json({ url, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラーが発生しました";
    console.error("[/api/estimates]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
