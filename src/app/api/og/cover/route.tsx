import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { supabase } from "@/lib/supabase";
import { getOrAssignPostNumber } from "../_postnumber";
import type { AnalyzeResponse, AgentInfo, CustomerInfo } from "@/types";

// 日本語フォントが約9MBあり Edge の容量制限を超えるため Node ランタイムで動かす。
export const runtime = "nodejs";
// slug ごとに内容が変わるので静的化しない。
export const dynamic = "force-dynamic";

const WIDTH = 1080;
const HEIGHT = 1350;
const TOP_H = 810; // 上部：物件写真
const BOTTOM_H = HEIGHT - TOP_H; // 下部：グリーンパネル（540px）

const GREEN = "#2d5e3a";
const LIGHT_GREEN = "#a9c9b5";
const YELLOW = "#f5d76e";
const PLACEHOLDER = "#e5e7eb";

// 保存ペイロードの形（estimate ページの SharedEstimate と同じ）
type SharedEstimate = {
  result?: AnalyzeResponse;
  agentInfo?: AgentInfo;
  customerInfo?: CustomerInfo;
  comment?: string;
  validUntil?: string;
  propertyPhotoUrls?: string[];
};

type EstimateRow = {
  slug: string;
  data: SharedEstimate;
  expires_at: string | null;
};

// フォントはモジュールスコープで一度だけ読み込んで使い回す。
// new URL(..., import.meta.url) にすることで webpack が .otf を出力に同梱する。
let fontsPromise: Promise<{ regular: Buffer; medium: Buffer }> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(new URL("./fonts/NotoSansJP-Regular.otf", import.meta.url)),
      readFile(new URL("./fonts/NotoSansJP-Medium.otf", import.meta.url)),
    ]).then(([regular, medium]) => ({ regular, medium }));
  }
  return fontsPromise;
}

async function fetchEstimate(slug: string): Promise<EstimateRow | null> {
  const { data, error } = await supabase
    .from("estimates")
    .select("slug, data, expires_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as EstimateRow;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  return row;
}

// 写真URLをサーバー側で取得し data URI 化（remote URL 直挿しより確実）。失敗時は null。
async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/jpeg";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const num = (n: number | undefined) => (n ?? 0).toLocaleString("ja-JP");
const yen = (n: number | undefined) => `¥${num(n)}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return new Response("slug が必要です（例: /api/og/cover?slug=xxxxxxxx）", { status: 400 });
  }

  const row = await fetchEstimate(slug);
  const prop = row?.data?.result?.extracted;
  if (!prop) {
    return new Response("見積もりが見つかりません（slug が正しいか確認してください）", { status: 404 });
  }

  // 投稿番号（?source= があれば記号だけ上書き。連番は順位ベースで安定）
  const postNumber = await getOrAssignPostNumber(slug, row.data, searchParams.get("source") || undefined);

  // 写真：最初の有効なURLを data URI 化。無ければプレースホルダ。
  const photoUrl = (row?.data?.propertyPhotoUrls ?? []).find(
    (u) => typeof u === "string" && u.length > 0,
  );
  const photoData = photoUrl ? await toDataUri(photoUrl) : null;

  const rentTotal = (prop.rent ?? 0) + (prop.managementFee ?? 0);

  const addressLine = prop.addressRomaji
    ? `${prop.address} ・ ${prop.addressRomaji}`
    : prop.address;

  const stationLine = prop.nearestStation
    ? prop.stationWalkMinutes
      ? `${prop.nearestStation} 徒歩${prop.stationWalkMinutes}分`
      : prop.nearestStation
    : "";

  const specParts: string[] = [];
  if (prop.floorPlan) specParts.push(prop.floorPlan);
  if (prop.area) specParts.push(`${prop.area}㎡`);
  const specLine = specParts.join(" / ");

  const noDepositKey = (prop.deposit ?? 0) === 0 && (prop.keyMoney ?? 0) === 0;
  const badgeText = noDepositKey
    ? "敷金・礼金 0円 / No deposit & no key money"
    : `敷金 ${yen(prop.deposit)} ・ 礼金 ${yen(prop.keyMoney)}`;

  const { regular, medium } = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          fontFamily: "Noto Sans JP",
        }}
      >
        {/* ===== 上部：物件写真（0〜810px） ===== */}
        <div style={{ position: "relative", width: WIDTH, height: TOP_H, display: "flex" }}>
          {photoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoData} width={WIDTH} height={TOP_H} style={{ objectFit: "cover" }} alt="" />
          ) : (
            <div style={{ width: WIDTH, height: TOP_H, display: "flex", backgroundColor: PLACEHOLDER }} />
          )}
          {/* 左上：Housing JP パネル */}
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 40,
              display: "flex",
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: "12px 26px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
            }}
          >
            <span style={{ color: GREEN, fontSize: 34, fontWeight: 500 }}>Housing JP</span>
          </div>
        </div>

        {/* ===== 下部：グリーンパネル（810〜1350px） ===== */}
        <div
          style={{
            position: "relative",
            width: WIDTH,
            height: BOTTOM_H,
            backgroundColor: GREEN,
            color: "#ffffff",
            display: "flex",
            flexDirection: "column",
            padding: "44px 56px",
          }}
        >
          {/* 賃料（大・Medium） */}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <span style={{ fontSize: 92, fontWeight: 500, lineHeight: 1 }}>{yen(rentTotal)}</span>
            <span style={{ fontSize: 28, marginLeft: 16, marginBottom: 10, color: "#dcebe1" }}>
              /月 ・ monthly (incl. fees)
            </span>
          </div>

          {/* 内訳（小・薄緑） */}
          <div style={{ display: "flex", marginTop: 10 }}>
            <span style={{ fontSize: 28, color: LIGHT_GREEN }}>
              家賃 {num(prop.rent)}円 ＋ 管理費 {num(prop.managementFee)}円
            </span>
          </div>

          {/* 所在地 */}
          <div style={{ display: "flex", marginTop: 26 }}>
            <span style={{ fontSize: 30 }}>{addressLine}</span>
          </div>

          {/* 駅（あれば） */}
          {stationLine ? (
            <div style={{ display: "flex", marginTop: 10 }}>
              <span style={{ fontSize: 30 }}>{stationLine}</span>
            </div>
          ) : null}

          {/* スペック */}
          {specLine ? (
            <div style={{ display: "flex", marginTop: 10 }}>
              <span style={{ fontSize: 30 }}>{specLine}</span>
            </div>
          ) : null}

          {/* 敷金・礼金バッジ */}
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginTop: 30,
              backgroundColor: YELLOW,
              borderRadius: 9999,
              padding: "12px 28px",
            }}
          >
            <span style={{ color: GREEN, fontSize: 28, fontWeight: 500 }}>{badgeText}</span>
          </div>

          {/* 右下：物件番号 */}
          <div style={{ position: "absolute", right: 56, bottom: 40, display: "flex" }}>
            <span style={{ fontSize: 26, color: "#cfe0d5" }}>No. {postNumber}</span>
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Noto Sans JP", data: regular, weight: 400, style: "normal" },
        { name: "Noto Sans JP", data: medium, weight: 500, style: "normal" },
      ],
      headers: {
        // 同じ slug の表紙は変わりにくいので少しキャッシュ（生成コスト抑制）
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
