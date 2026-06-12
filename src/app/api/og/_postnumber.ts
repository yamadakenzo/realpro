import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabase";
import type { IgPost } from "./_shared";

// 投稿番号の採番（★保存方式／固定方式★）。
// 形式：ソース記号 + 3桁連番（例 "I-012"）。
//
// 方針：
//  1. estimates.data.igPost.number が既にあれば、それを最優先で返す（再生成・他物件の増減で番号が変わらない）。
//  2. 未採番の物件は「これまでの決定論の順位（created_at 通し順位）」を初回 seq として決め、
//     estimates.data.igPost（number / seq / source）に保存する（service_role の UPDATE 権限が必要）。
//  3. 保存済み seq との衝突回避：順位が既存の保存 seq と被る場合のみ「最大 seq + 1」へ退避（重複番号を出さない）。
//  → 結果として、物件を削除しても残った物件の番号は保存値のまま変わらず、消えた番号は欠番（歯抜け）になる。
//
// 補足：GRANT UPDATE ON public.estimates TO service_role; が前提（実行済み）。
// 万一 service_role が使えない場合は保存をスキップし、番号は返すが固定されない（ログに警告）。

type PostNumberData = {
  result?: { extracted?: { source?: string } };
  igPost?: IgPost;
};

// 取得元 → 記号。イタンジBB=T / ATBB=A / realpro=P。未指定・不明は T。
// （I は数字1と、R は口頭発音が紛らわしいため T/A/P に変更。
//   旧データの記号 I/R も後方互換で T/P に寄せる：I=イタンジ→T、R=realpro→P）
export function sourceLetter(source: string | undefined): string {
  switch (source) {
    case "T":
    case "I":
    case "itandi":
    case "イタンジBB":
    case "イタンジ":
      return "T";
    case "A":
    case "atbb":
    case "ATBB":
      return "A";
    case "P":
    case "R":
    case "realpro":
      return "P";
    default:
      return "T";
  }
}

export const pad3 = (n: number) => String(n).padStart(3, "0");

// overrideSource: 画面のソース記号セレクタからの上書き。未採番のときの記号にのみ反映される
// （一度保存された番号は最優先で返すため、保存後は上書きしても変わらない＝固定）。
export async function getOrAssignPostNumber(
  slug: string,
  data: PostNumberData,
  overrideSource?: string,
): Promise<string> {
  // 1. 保存済みの番号があれば最優先（固定）
  if (data.igPost?.number) return data.igPost.number;

  const letter = overrideSource
    ? sourceLetter(overrideSource)
    : sourceLetter(data.result?.extracted?.source);

  const admin = getSupabaseAdmin();
  const client = admin ?? supabase; // 読み取りはどちらでも可

  try {
    const { data: rows, error } = await client.from("estimates").select("slug, data, created_at");
    if (error || !rows) {
      console.error("[og/_postnumber] 一覧取得に失敗", error);
      return "SAMPLE";
    }

    const mapped = rows.map((r) => {
      const row = r as { slug?: string; created_at?: string | null; data?: { igPost?: { seq?: number } } };
      return {
        slug: String(row.slug ?? ""),
        createdAt: String(row.created_at ?? ""),
        savedSeq: typeof row.data?.igPost?.seq === "number" ? row.data.igPost.seq : undefined,
      };
    });

    // 2. 決定論の順位（created_at 昇順／同時刻は slug 昇順）でこの物件の初回 seq を決める
    const sorted = [...mapped].sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
    const idx = sorted.findIndex((r) => r.slug === slug);
    let seq = idx >= 0 ? idx + 1 : sorted.length + 1;

    // 3. 既存の保存 seq と衝突する場合のみ「最大 seq + 1」へ退避（重複防止）
    const otherSavedSeqs = mapped
      .filter((r) => r.slug !== slug && typeof r.savedSeq === "number")
      .map((r) => r.savedSeq as number);
    if (otherSavedSeqs.includes(seq)) {
      seq = Math.max(0, ...otherSavedSeqs) + 1;
    }

    const number = `${letter}-${pad3(seq)}`;

    // 4. 保存（service_role の UPDATE 権限が必要）
    if (admin) {
      const igPost: IgPost = { number, seq, source: letter, assignedAt: new Date().toISOString() };
      const newData = { ...(data as Record<string, unknown>), igPost };
      const { error: upErr } = await admin.from("estimates").update({ data: newData }).eq("slug", slug);
      if (upErr) console.error("[og/_postnumber] 番号の保存に失敗", upErr);
    } else {
      console.warn("[og/_postnumber] サービスロール未設定のため保存をスキップ（番号は固定されません）");
    }

    return number;
  } catch (e) {
    console.error("[og/_postnumber] 採番エラー", e);
    return "SAMPLE";
  }
}
