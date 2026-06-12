import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sourceLetter, pad3 } from "@/app/api/og/_postnumber";

// 物件ごとの取得元（source）を保存し、投稿番号を新体系で振り直すエンドポイント。
// /instagram のソース選択UIから呼ぶ。認証必須ルート（/api/estimates 配下）。
// - source は意味キー（"itandi" / "atbb" / "realpro"）を保存（記号が将来また変わってもデータ移行不要）
// - 連番 seq は既存があれば維持。無ければ created_at 通し順位で算出（og 側の採番と一致）
// - igPost.number / source（記号）を更新して固定保存（service_role の UPDATE 権限が必要）
export const dynamic = "force-dynamic";

type EstimateData = {
  result?: { extracted?: Record<string, unknown> };
  igPost?: { seq?: number };
  [k: string]: unknown;
};

const VALID_SOURCES = new Set(["itandi", "atbb", "realpro"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { slug?: unknown; source?: unknown };
    const slug = typeof body.slug === "string" ? body.slug : "";
    const source = typeof body.source === "string" ? body.source : "";
    if (!slug || !VALID_SOURCES.has(source)) {
      return Response.json({ error: "slug と source（itandi/atbb/realpro）が必要です" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return Response.json({ error: "サーバー設定エラー（サービスロール未設定）" }, { status: 500 });
    }

    const { data: row, error } = await admin
      .from("estimates")
      .select("slug, data")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !row) {
      return Response.json({ error: "物件が見つかりません" }, { status: 404 });
    }

    const data = (row.data ?? {}) as EstimateData;
    const letter = sourceLetter(source);

    // seq は既存を維持。無ければ created_at 通し順位で算出（og の採番と同じ並び）
    let seq = data.igPost?.seq;
    if (typeof seq !== "number") {
      const { data: allRows } = await admin.from("estimates").select("slug, created_at");
      const sorted = (allRows ?? [])
        .map((r) => {
          const rr = r as { slug?: string; created_at?: string | null };
          return { slug: String(rr.slug ?? ""), createdAt: String(rr.created_at ?? "") };
        })
        .sort((a, b) => {
          if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
          return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
        });
      const idx = sorted.findIndex((r) => r.slug === slug);
      seq = idx >= 0 ? idx + 1 : sorted.length + 1;
    }

    const number = `${letter}-${pad3(seq)}`;
    const extracted = { ...(data.result?.extracted ?? {}), source };
    const newData = {
      ...data,
      result: { ...(data.result ?? {}), extracted },
      igPost: { number, seq, source: letter, assignedAt: new Date().toISOString() },
    };

    const { error: upErr } = await admin.from("estimates").update({ data: newData }).eq("slug", slug);
    if (upErr) {
      console.error("[/api/estimates/source] 保存に失敗", upErr);
      return Response.json({ error: "保存に失敗しました" }, { status: 500 });
    }

    return Response.json({ slug, source, letter, number });
  } catch (e) {
    console.error("[/api/estimates/source]", e);
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
