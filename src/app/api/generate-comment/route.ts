import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import type { CostItem, ExtractedProperty, Language, MonthlyItem } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LANG_NAMES: Record<Language, string> = {
  ja: "日本語",
  en: "英語 (English)",
  zh: "中国語簡体字 (简体中文)",
  "zh-tw": "中国語繁体字 (繁體中文)",
  ko: "韓国語 (한국어)",
  vi: "ベトナム語 (Tiếng Việt)",
  ne: "ネパール語 (नेपाली)",
  es: "スペイン語 (Español)",
  pt: "ポルトガル語 (Português)",
  id: "インドネシア語 (Bahasa Indonesia)",
};

type NearbyPlace = { name: string };
type NearbyResult = {
  stations: NearbyPlace[];
  supermarkets: NearbyPlace[];
  convenienceStores: NearbyPlace[];
  schools: NearbyPlace[];
};

async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("language", "ja");
  url.searchParams.set("region", "jp");
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) return null;
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

async function searchNearby(
  lat: number,
  lng: number,
  type: string,
  apiKey: string,
  limit = 3
): Promise<NearbyPlace[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("rankby", "distance");
  url.searchParams.set("type", type);
  url.searchParams.set("language", "ja");
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== "OK") return [];
  return (data.results || []).slice(0, limit).map((r: { name: string }) => ({ name: r.name }));
}

async function fetchNearby(address: string): Promise<NearbyResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !address) return null;
  const loc = await geocodeAddress(address, apiKey);
  if (!loc) return null;

  const [stations, supermarkets, convenienceStores, schools] = await Promise.all([
    searchNearby(loc.lat, loc.lng, "train_station", apiKey, 3),
    searchNearby(loc.lat, loc.lng, "supermarket", apiKey, 2),
    searchNearby(loc.lat, loc.lng, "convenience_store", apiKey, 2),
    searchNearby(loc.lat, loc.lng, "school", apiKey, 2),
  ]);
  return { stations, supermarkets, convenienceStores, schools };
}

function formatNearby(nearby: NearbyResult | null): string {
  if (!nearby) return "（周辺施設情報は取得できませんでした）";
  const lines = [
    nearby.stations.length > 0 ? `最寄り駅: ${nearby.stations.map((s) => s.name).join("、")}` : null,
    nearby.supermarkets.length > 0 ? `スーパー: ${nearby.supermarkets.map((s) => s.name).join("、")}` : null,
    nearby.convenienceStores.length > 0 ? `コンビニ: ${nearby.convenienceStores.map((s) => s.name).join("、")}` : null,
    nearby.schools.length > 0 ? `学校: ${nearby.schools.map((s) => s.name).join("、")}` : null,
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : "（周辺施設情報なし）";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      extracted: ExtractedProperty;
      costs?: CostItem[];
      monthlyCosts?: MonthlyItem[];
      language: Language;
    };

    const { extracted, costs = [], monthlyCosts = [], language } = body;

    if (!extracted) {
      return Response.json({ error: "物件情報が必要です" }, { status: 400 });
    }

    const nearby = await fetchNearby(extracted.address || extracted.propertyName);

    const totalCost = costs.reduce((s, c) => s + c.amount, 0);
    const monthlyTotal = monthlyCosts.find((m) => m.id === "monthly_total")?.amount ?? 0;
    const langName = LANG_NAMES[language] ?? LANG_NAMES.en;
    const nearbyText = formatNearby(nearby);

    const prompt = `あなたは外国人向け賃貸物件を扱う日本の不動産仲介担当者です。以下の物件情報をもとに、お客様（外国人）への「担当者コメント」を書いてください。

【物件情報】
物件名: ${extracted.propertyName || "（不明）"}
住所: ${extracted.address || "（不明）"}
間取り: ${extracted.floorPlan || "（不明）"}
面積: ${extracted.area > 0 ? extracted.area + "m²" : "（不明）"}
家賃: ${extracted.rent > 0 ? extracted.rent.toLocaleString("ja-JP") + "円" : "（不明）"}
管理費: ${extracted.managementFee > 0 ? extracted.managementFee.toLocaleString("ja-JP") + "円" : "（不明）"}
敷金: ${extracted.deposit.toLocaleString("ja-JP")}円
礼金: ${extracted.keyMoney.toLocaleString("ja-JP")}円
初期費用合計: ${totalCost > 0 ? totalCost.toLocaleString("ja-JP") + "円" : "（未計算）"}
月額合計: ${monthlyTotal > 0 ? monthlyTotal.toLocaleString("ja-JP") + "円" : "（未計算）"}

【周辺施設】
${nearbyText}

【ルール】
- まず日本語で3〜4文のコメントを書く
- 次に${langName}で同じ趣旨を3〜4文で書く
- 出力フォーマット：日本語文を書いた後、空行（改行2つ）を入れて、${langName}の文を書く
- 物件の魅力（駅・スーパー・コンビニ・学校など）は周辺施設情報から具体名を1〜2件だけ織り交ぜる。情報がない種類は触れなくてよい
- 数字（家賃や初期費用の具体額）はコメント本文で繰り返さない。生活面・利便性のメリットを中心に伝える
- 仲介担当者として、お客様に安心して住んでいただける物件です、というあたたかい温度感
- 余計な装飾（**や箇条書き）は使わず、自然な文章のみ
- 「以下が回答です」などの前置きや、ラベル（"日本語:" など）は不要。本文のみを出力する

それでは出力してください。`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    return Response.json({
      comment: text,
      usedPlacesApi: nearby !== null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラーが発生しました";
    console.error("[/api/generate-comment]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
