// Instagram 投稿画像（next/og）の共通部品。
// 表紙 /api/og/cover と同じ「フォント読込・データ取得・色・共通パーツ」をここに集約し、
// 2〜4枚目（floorplan / spec / cta）の各ルートから流用する。
// 既存機能（見積書・PDF・比較表・コメント生成）には一切影響しない新規モジュール。
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import type { ReactElement } from "react";
import { supabase } from "@/lib/supabase";
import type { AnalyzeResponse, AgentInfo, CustomerInfo, ExtractedProperty } from "@/types";

export const WIDTH = 1080;
export const HEIGHT = 1350;

// 表紙と統一したカラー
export const GREEN = "#2d5e3a";
export const LIGHT_GREEN = "#a9c9b5";
export const YELLOW = "#f5d76e";
export const PLACEHOLDER = "#e5e7eb";
export const PANEL_GRAY = "#f1f3ef";

// Instagram 投稿番号（採番したら estimates.data に保存して再生成でも変わらないようにする）
export type IgPost = {
  number: string; // 例: "I-012"
  seq: number; // 全体通しの連番（採番の元）
  source: string; // 記号（R / A / I）
  assignedAt: string;
};

// 保存ペイロードの形（estimate ページ / 表紙ルートと同じ）
export type SharedEstimate = {
  result?: AnalyzeResponse;
  agentInfo?: AgentInfo;
  customerInfo?: CustomerInfo;
  comment?: string;
  validUntil?: string;
  propertyPhotoUrls?: string[];
  igPost?: IgPost;
};

export type EstimateRow = {
  slug: string;
  data: SharedEstimate;
  expires_at: string | null;
  created_at?: string | null;
};

// ===== フォント（モジュールスコープで一度だけ読み込み使い回す） =====
// フォント本体は表紙ルートのフォルダに同梱済み。new URL(..., import.meta.url) で
// webpack が .otf を出力に同梱するので、この共有モジュールからの相対参照で読み込む。
let fontsPromise: Promise<{ regular: Buffer; medium: Buffer }> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(new URL("./cover/fonts/NotoSansJP-Regular.otf", import.meta.url)),
      readFile(new URL("./cover/fonts/NotoSansJP-Medium.otf", import.meta.url)),
    ]).then(([regular, medium]) => ({ regular, medium }));
  }
  return fontsPromise;
}

// JSX を 1080×1350 PNG にして返す共通ヘルパー（フォント・キャッシュ設定込み）
export async function renderOg(element: ReactElement): Promise<ImageResponse> {
  const { regular, medium } = await loadFonts();
  return new ImageResponse(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Noto Sans JP", data: regular, weight: 400, style: "normal" },
      { name: "Noto Sans JP", data: medium, weight: 500, style: "normal" },
    ],
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

// ===== データ取得（表紙ルートと同じ） =====
export async function fetchEstimate(slug: string): Promise<EstimateRow | null> {
  const { data, error } = await supabase
    .from("estimates")
    .select("slug, data, expires_at, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as EstimateRow;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  return row;
}

export function getPhotos(row: EstimateRow | null): string[] {
  return (row?.data?.propertyPhotoUrls ?? []).filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
}

// 写真URLをサーバー側で取得して data URI 化（remote URL 直挿しより確実）。失敗時は null。
export async function toDataUri(url: string): Promise<string | null> {
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

// ===== 表示ヘルパー =====
export const num = (n: number | undefined) => (n ?? 0).toLocaleString("ja-JP");
export const yen = (n: number | undefined) => `¥${num(n)}`;

// 方位（facilities の中に「○向き」等があれば取り出して日英にする）。無ければ null。
export function getFacing(facilities?: string[]): { ja: string; en: string } | null {
  const f = (facilities ?? []).find((x) => x.includes("向き") || /^[東西南北]+$/.test(x));
  if (!f) return null;
  // 複合方位（南東など）を単一方位より先に判定する
  const map: readonly [string, string][] = [
    ["南東", "Southeast"], ["南西", "Southwest"], ["北東", "Northeast"], ["北西", "Northwest"],
    ["南", "South"], ["北", "North"], ["東", "East"], ["西", "West"],
  ];
  for (const [jp, en] of map) {
    if (f.includes(jp)) return { ja: f, en: `${en}-facing` };
  }
  return { ja: f, en: "" };
}

// 設備の英語併記（主要なものだけ訳す。未知の語は日本語のみ）
const FEATURE_EN: Record<string, string> = {
  "オートロック": "Auto-lock",
  "宅配BOX": "Delivery box",
  "宅配ボックス": "Delivery box",
  "バストイレ別": "Separate bath & toilet",
  "追い焚き": "Reheating bath",
  "独立洗面台": "Vanity sink",
  "エアコン": "Air conditioner",
  "室内洗濯機置場": "Indoor washer space",
  "モニター付インターホン": "Video intercom",
  "2階以上": "2nd floor or above",
  "南向き": "South-facing",
  "北向き": "North-facing",
  "東向き": "East-facing",
  "西向き": "West-facing",
  "駐車場あり": "Parking",
  "ペット可": "Pets allowed",
  "楽器可": "Instruments allowed",
};

export function featuresBilingual(facilities?: string[]): { jaText: string; enText: string } {
  const ja = (facilities ?? []).filter(Boolean);
  const en = ja.map((f) => FEATURE_EN[f]).filter(Boolean);
  return { jaText: ja.join("　・　"), enText: en.join(" · ") };
}

export type Prop = ExtractedProperty;

// ===== 共通JSXパーツ =====

// 左上の白い「Housing JP」パネル（表紙と同じ見た目）
export function HousingJpPanel({ top = 36, left = 40 }: { top?: number; left?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        display: "flex",
        backgroundColor: "#ffffff",
        borderRadius: 14,
        padding: "10px 22px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
      }}
    >
      <span style={{ color: GREEN, fontSize: 30, fontWeight: 500 }}>Housing JP</span>
    </div>
  );
}

// 右下の物件番号。value は採番済みの番号（例 "I-012"）。未採番時は "SAMPLE" にフォールバック。
export function PropertyNumber({ value = "SAMPLE", color = "#9bb3a3" }: { value?: string; color?: string }) {
  return (
    <div style={{ position: "absolute", right: 48, bottom: 36, display: "flex" }}>
      <span style={{ fontSize: 26, color }}>No. {value}</span>
    </div>
  );
}

// 上部 150px のグリーンヘッダー（日本語＋英語の見出し）。左上の Housing JP パネルも内包する。
export function GreenHeader({ titleJa, titleEn }: { titleJa: string; titleEn: string }) {
  return (
    <div
      style={{
        position: "relative",
        width: WIDTH,
        height: 150,
        backgroundColor: GREEN,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ color: "#ffffff", fontSize: 46, fontWeight: 500, lineHeight: 1.1 }}>{titleJa}</span>
      <span style={{ color: LIGHT_GREEN, fontSize: 26, marginTop: 4 }}>{titleEn}</span>
      <HousingJpPanel top={30} left={36} />
    </div>
  );
}
