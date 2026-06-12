import {
  WIDTH, HEIGHT, GREEN, LIGHT_GREEN, YELLOW,
  fetchEstimate, renderOg,
} from "../_shared";
import { getOrAssignPostNumber } from "../_postnumber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 4枚目：問い合わせ（CTA）
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return new Response("slug が必要です（例: /api/og/cta?slug=xxxxxxxx）", { status: 400 });
  }

  // CTA は物件個別の文言を出さないが、slug の妥当性は確認しておく（存在しなければ404）
  const row = await fetchEstimate(slug);
  if (!row?.data?.result?.extracted) {
    return new Response("見積もりが見つかりません（slug が正しいか確認してください）", { status: 404 });
  }

  // 投稿番号（表紙と共有。?source= があれば記号だけ上書き）
  const postNumber = await getOrAssignPostNumber(slug, row.data, searchParams.get("source") || undefined);

  return renderOg(
    <div
      style={{
        position: "relative",
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: GREEN,
        fontFamily: "Noto Sans JP",
        padding: "0 90px",
      }}
    >
      {/* 見出し */}
      <div style={{ display: "flex", width: 900, justifyContent: "center", textAlign: "center" }}>
        <span style={{ fontSize: 58, fontWeight: 500, color: "#ffffff", lineHeight: 1.35 }}>
          このお部屋について相談してみませんか？
        </span>
      </div>
      <div style={{ display: "flex", marginTop: 16 }}>
        <span style={{ fontSize: 30, color: LIGHT_GREEN }}>Ask us anything about this room</span>
      </div>

      {/* 白い角丸ボタン風（画像なので実リンクではなくデザイン上のボタン） */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 70,
          backgroundColor: "#ffffff",
          borderRadius: 9999,
          padding: "30px 80px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}
      >
        <span style={{ fontSize: 46, fontWeight: 500, color: GREEN }}>LINEで無料相談</span>
        <span style={{ fontSize: 24, color: "#6f9079", marginTop: 4 }}>Free chat on LINE</span>
      </div>

      {/* プロフィールのリンク誘導 */}
      <div style={{ display: "flex", marginTop: 56 }}>
        <span style={{ fontSize: 36, fontWeight: 500, color: "#ffffff" }}>プロフィールのリンクから →</span>
      </div>
      <div style={{ display: "flex", marginTop: 8 }}>
        <span style={{ fontSize: 26, color: LIGHT_GREEN }}>Tap the link in our profile</span>
      </div>

      {/* お問い合わせ番号（黄色） */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 72 }}>
        <span style={{ fontSize: 24, color: LIGHT_GREEN }}>お問い合わせ番号</span>
        <span style={{ fontSize: 40, fontWeight: 500, color: YELLOW, marginTop: 6 }}>No. {postNumber}</span>
      </div>

      {/* Housing JP（下部） */}
      <div style={{ position: "absolute", bottom: 56, display: "flex" }}>
        <span style={{ fontSize: 34, fontWeight: 500, color: "#ffffff" }}>Housing JP</span>
      </div>
    </div>,
  );
}
