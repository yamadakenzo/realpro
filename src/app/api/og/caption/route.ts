import { fetchEstimate, yen } from "../_shared";
import { getOrAssignPostNumber } from "../_postnumber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ===== 業者の表示義務情報（定数）=====
// 将来は設定画面（会社ごと）で変えられるようにする想定。今は固定。
const AGENCY_NAME = "レスト不動産";
const AGENCY_LICENSE = "愛知県知事(1)第25821号";

// 47都道府県（日本語→英語）。英語フラグ行・ハッシュタグに使う。
const PREF_EN: Record<string, string> = {
  "北海道": "Hokkaido", "青森県": "Aomori", "岩手県": "Iwate", "宮城県": "Miyagi",
  "秋田県": "Akita", "山形県": "Yamagata", "福島県": "Fukushima", "茨城県": "Ibaraki",
  "栃木県": "Tochigi", "群馬県": "Gunma", "埼玉県": "Saitama", "千葉県": "Chiba",
  "東京都": "Tokyo", "神奈川県": "Kanagawa", "新潟県": "Niigata", "富山県": "Toyama",
  "石川県": "Ishikawa", "福井県": "Fukui", "山梨県": "Yamanashi", "長野県": "Nagano",
  "岐阜県": "Gifu", "静岡県": "Shizuoka", "愛知県": "Aichi", "三重県": "Mie",
  "滋賀県": "Shiga", "京都府": "Kyoto", "大阪府": "Osaka", "兵庫県": "Hyogo",
  "奈良県": "Nara", "和歌山県": "Wakayama", "鳥取県": "Tottori", "島根県": "Shimane",
  "岡山県": "Okayama", "広島県": "Hiroshima", "山口県": "Yamaguchi", "徳島県": "Tokushima",
  "香川県": "Kagawa", "愛媛県": "Ehime", "高知県": "Kochi", "福岡県": "Fukuoka",
  "佐賀県": "Saga", "長崎県": "Nagasaki", "熊本県": "Kumamoto", "大分県": "Oita",
  "宮崎県": "Miyazaki", "鹿児島県": "Kagoshima", "沖縄県": "Okinawa",
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// 日本語住所から 都道府県 / 市区町村 / 小エリア を取り出す
function parseJpLocation(address: string): { prefJp: string; prefEn: string; cityJp: string; areaJp: string } {
  let prefJp = "", prefEn = "";
  for (const k of Object.keys(PREF_EN)) {
    if (address.startsWith(k)) { prefJp = k; prefEn = PREF_EN[k]; break; }
  }
  let rest = prefJp ? address.slice(prefJp.length) : address;
  const cityMatch = rest.match(/^(.+?[市区町村])/);
  const cityJp = cityMatch ? cityMatch[1] : "";
  rest = cityJp ? rest.slice(cityJp.length) : rest;
  // 小エリア（丁目・番地の数字より前）
  const areaMatch = rest.match(/^([^\d０-９]+?)(?=[\d０-９]|丁目|$)/);
  let areaJp = areaMatch ? areaMatch[1].trim() : "";
  areaJp = areaJp.replace(/[-－ー\s]+$/, "");
  return { prefJp, prefEn, cityJp, areaJp };
}

// ローマ字住所から市区名（英語）を取り出す（例 "Setagaya-ku" → "Setagaya"）
function parseCityFromRomaji(romaji: string): string {
  if (!romaji) return "";
  const parts = romaji.split(",").map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    const m = p.match(/^(.*?)[\s-]?(ku|shi|cho|machi|gun|son|city|ward)$/i);
    if (m && m[1]) return cap(m[1].replace(/[-\s]+$/, ""));
  }
  if (parts.length >= 2) return cap(parts[parts.length - 2].replace(/-(ku|shi|cho|machi)$/i, ""));
  return "";
}

function formatDate(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const valid = !Number.isNaN(d.getTime()) ? d : new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${valid.getFullYear()}/${p(valid.getMonth() + 1)}/${p(valid.getDate())}`;
}

// ハッシュタグ用に記号・空白を除去
const tag = (s: string) => "#" + s.replace(/[\s　（）()\/・,，。、.\-｜|]/g, "");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return new Response("slug が必要です（例: /api/og/caption?slug=xxxxxxxx）", { status: 400 });
  }

  const row = await fetchEstimate(slug);
  const prop = row?.data?.result?.extracted;
  if (!prop) {
    return new Response("見積もりが見つかりません（slug が正しいか確認してください）", { status: 404 });
  }

  const number = await getOrAssignPostNumber(slug, row!.data, searchParams.get("source") || undefined);

  const total = (prop.rent ?? 0) + (prop.managementFee ?? 0);
  const noDepositKey = (prop.deposit ?? 0) === 0 && (prop.keyMoney ?? 0) === 0;
  const floorPlan = prop.floorPlan || "";
  const area = prop.area ? `${prop.area}㎡` : "";

  const { prefJp, prefEn, cityJp, areaJp } = parseJpLocation(prop.address || "");
  const cityEn = parseCityFromRomaji(prop.addressRomaji || "") || cityJp;
  const prefForFlag = prefEn || prefJp;

  // 1行目：英語の旗
  const flagLoc = [prefForFlag, cityEn].filter(Boolean).join(" / ");
  const flag = `🌏 ${flagLoc || "Japan"}${floorPlan ? ` — ${floorPlan} apartment` : ""}`;

  // 本文（日本語）
  const feats: string[] = [];
  if (noDepositKey) feats.push("敷金礼金0円");
  for (const sp of prop.salesPoints ?? []) feats.push(sp);
  const featText = feats.length ? `${feats.slice(0, 3).join("、")}が魅力のお部屋です。` : "";
  const areaPhrase = `${cityJp}${areaJp}`.trim();
  const body =
    `${areaPhrase ? `${areaPhrase}エリアの` : ""}${floorPlan}${area ? `・${area}` : ""}。` +
    `${featText}【No. ${number}】`;

  // スペック
  const station = prop.nearestStation
    ? prop.stationWalkMinutes
      ? `${prop.nearestStation} 徒歩${prop.stationWalkMinutes}分`
      : prop.nearestStation
    : "";
  const moveIn = noDepositKey ? "敷金・礼金なし" : `敷金 ${yen(prop.deposit)}／礼金 ${yen(prop.keyMoney)}`;
  const facilitiesTop = (prop.facilities ?? []).slice(0, 4).join("・");

  const specLines: string[] = [];
  specLines.push(`💰 毎月の総額：${yen(total)}（管理費込）`);
  if (station) specLines.push(`🚃 ${station}`);
  specLines.push(`📐 ${[floorPlan, area].filter(Boolean).join(" / ") || "—"}`);
  specLines.push(`🔑 ${moveIn}${facilitiesTop ? `｜${facilitiesTop}` : ""}`);

  // 誘導
  const cta = [
    "📩 内見・相談はLINEで（無料）",
    `※お問い合わせは【No. ${number}】とお伝えください`,
  ].join("\n");

  // 表示義務（区切り線内）
  const legal = [
    "──────────────",
    "取引態様：媒介",
    `宅地建物取引業者：${AGENCY_NAME}（免許番号 ${AGENCY_LICENSE}）`,
    `情報更新日：${formatDate(row?.created_at)}`,
    "──────────────",
  ].join("\n");

  // ハッシュタグ（日本語＋英語）
  const tags: string[] = [];
  if (cityJp) tags.push(tag(cityJp));
  if (areaJp) tags.push(tag(areaJp));
  if (noDepositKey) tags.push("#敷金礼金なし");
  for (const sp of prop.salesPoints ?? []) tags.push(tag(sp));
  if (floorPlan) tags.push(tag(floorPlan));
  tags.push("#賃貸", "#お部屋探し", "#一人暮らし");
  if (prefEn) tags.push(tag(prefEn.toLowerCase()) + "life");
  tags.push("#japanrental", "#japanapartment", "#japanrealestate");
  // 重複除去
  const hashtags = Array.from(new Set(tags)).join(" ");

  const caption = [
    flag,
    "",
    body,
    "",
    specLines.join("\n"),
    "",
    cta,
    "",
    legal,
    "",
    hashtags,
  ].join("\n");

  return new Response(caption, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
