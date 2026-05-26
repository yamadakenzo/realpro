import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
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

type NearbyPlace = { name: string; minutes: number };

type NearbyResult = {
  stations: NearbyPlace[];
  busStops: NearbyPlace[];
  supermarkets: NearbyPlace[];
  convenienceStores: NearbyPlace[];
  drugstores: NearbyPlace[];
  hundredYenShops: NearbyPlace[];
  clinics: NearbyPlace[];
  dentists: NearbyPlace[];
  parks: NearbyPlace[];
  nurseries: NearbyPlace[];
  kindergartens: NearbyPlace[];
  elementarySchools: NearbyPlace[];
  laundries: NearbyPlace[];
  postOffices: NearbyPlace[];
  atms: NearbyPlace[];
};

// 直線距離(m)→徒歩分数。Google目安の徒歩80m/分で算出し切り上げ
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function metersToWalkMinutes(m: number): number {
  return Math.max(1, Math.ceil(m / 80));
}

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

type RawNearby = {
  name: string;
  geometry?: { location?: { lat: number; lng: number } };
};

async function searchNearby(
  origin: { lat: number; lng: number },
  params: { type?: string; keyword?: string },
  apiKey: string,
  limit = 2
): Promise<NearbyPlace[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${origin.lat},${origin.lng}`);
  url.searchParams.set("rankby", "distance");
  if (params.type) url.searchParams.set("type", params.type);
  if (params.keyword) url.searchParams.set("keyword", params.keyword);
  url.searchParams.set("language", "ja");
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== "OK") return [];
  return (data.results || [])
    .slice(0, limit)
    .map((r: RawNearby) => {
      const loc = r.geometry?.location;
      const minutes = loc ? metersToWalkMinutes(haversineMeters(origin, loc)) : 0;
      return { name: r.name, minutes };
    });
}

async function fetchNearby(address: string): Promise<NearbyResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !address) return null;
  const loc = await geocodeAddress(address, apiKey);
  if (!loc) return null;

  const [
    stations,
    busStops,
    supermarkets,
    convenienceStores,
    drugstores,
    hundredYenShops,
    clinics,
    dentists,
    parks,
    nurseries,
    kindergartens,
    elementarySchools,
    laundries,
    postOffices,
    atms,
  ] = await Promise.all([
    searchNearby(loc, { type: "train_station" }, apiKey, 2),
    searchNearby(loc, { type: "bus_station" }, apiKey, 2),
    searchNearby(loc, { type: "supermarket" }, apiKey, 2),
    searchNearby(loc, { type: "convenience_store" }, apiKey, 2),
    searchNearby(loc, { type: "drugstore" }, apiKey, 2),
    searchNearby(loc, { keyword: "100円ショップ" }, apiKey, 1),
    searchNearby(loc, { keyword: "内科" }, apiKey, 2),
    searchNearby(loc, { type: "dentist" }, apiKey, 2),
    searchNearby(loc, { type: "park" }, apiKey, 2),
    searchNearby(loc, { keyword: "保育園" }, apiKey, 2),
    searchNearby(loc, { keyword: "幼稚園" }, apiKey, 2),
    searchNearby(loc, { type: "primary_school" }, apiKey, 1),
    searchNearby(loc, { keyword: "コインランドリー" }, apiKey, 1),
    searchNearby(loc, { type: "post_office" }, apiKey, 1),
    searchNearby(loc, { type: "atm" }, apiKey, 1),
  ]);

  return {
    stations,
    busStops,
    supermarkets,
    convenienceStores,
    drugstores,
    hundredYenShops,
    clinics,
    dentists,
    parks,
    nurseries,
    kindergartens,
    elementarySchools,
    laundries,
    postOffices,
    atms,
  };
}

function joinPlaces(places: NearbyPlace[]): string {
  return places
    .map((p) => (p.minutes > 0 ? `${p.name}（徒歩約${p.minutes}分）` : p.name))
    .join("、");
}

function formatNearby(nearby: NearbyResult | null): string {
  if (!nearby) return "（周辺施設情報は取得できませんでした）";

  const stationWalk = nearby.stations[0]?.minutes ?? 0;
  const stationFar = stationWalk === 0 || stationWalk >= 15;

  const lines = [
    nearby.stations.length > 0 ? `最寄り駅: ${joinPlaces(nearby.stations)}` : null,
    stationFar && nearby.busStops.length > 0 ? `バス停: ${joinPlaces(nearby.busStops)}` : null,
    nearby.supermarkets.length > 0 ? `スーパー: ${joinPlaces(nearby.supermarkets)}` : null,
    nearby.convenienceStores.length > 0 ? `コンビニ: ${joinPlaces(nearby.convenienceStores)}` : null,
    nearby.drugstores.length > 0 ? `ドラッグストア: ${joinPlaces(nearby.drugstores)}` : null,
    nearby.hundredYenShops.length > 0 ? `100円ショップ: ${joinPlaces(nearby.hundredYenShops)}` : null,
    nearby.clinics.length > 0 ? `内科クリニック: ${joinPlaces(nearby.clinics)}` : null,
    nearby.dentists.length > 0 ? `歯科クリニック: ${joinPlaces(nearby.dentists)}` : null,
    nearby.parks.length > 0 ? `公園: ${joinPlaces(nearby.parks)}` : null,
    nearby.nurseries.length > 0 ? `保育園: ${joinPlaces(nearby.nurseries)}` : null,
    nearby.kindergartens.length > 0 ? `幼稚園: ${joinPlaces(nearby.kindergartens)}` : null,
    nearby.elementarySchools.length > 0 ? `小学校: ${joinPlaces(nearby.elementarySchools)}` : null,
    nearby.laundries.length > 0 ? `コインランドリー: ${joinPlaces(nearby.laundries)}` : null,
    nearby.postOffices.length > 0 ? `郵便局: ${joinPlaces(nearby.postOffices)}` : null,
    nearby.atms.length > 0 ? `銀行ATM: ${joinPlaces(nearby.atms)}` : null,
  ].filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : "（周辺施設情報なし）";
}

// housing-jp の Supabase customers テーブルから顧客情報を取得
// 列名は実テーブルに合わせて後で調整可能。現状は SELECT * で取得して JSON でプロンプトに渡す方針
async function fetchCustomer(customerId: string): Promise<Record<string, unknown> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !customerId) return null;

  try {
    const sb = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .maybeSingle();
    if (error) {
      console.warn("[generate-comment] customer fetch error:", error.message);
      return null;
    }
    return (data as Record<string, unknown>) ?? null;
  } catch (e) {
    console.warn("[generate-comment] customer fetch exception:", e);
    return null;
  }
}

// 顧客レコードから「強調すべき方向性」をルールで抽出（プロンプトに添える）
function analyzeCustomerHints(
  customer: Record<string, unknown> | null,
  stationMinutes: number
): string[] {
  if (!customer) return [];
  const hints: string[] = [];

  // 全フィールドを 1 つの文字列にまとめてキーワード判定する（列名に依存しない）
  const blob = Object.values(customer)
    .map((v) => {
      if (v == null) return "";
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      try {
        return JSON.stringify(v);
      } catch {
        return "";
      }
    })
    .join(" ")
    .toLowerCase();

  if (/(駐車|車|parking|car)/.test(blob)) {
    hints.push("駐車場・車での生活がしやすいかを気にしている");
  }
  if (/(子|学校|保育|幼稚|child|school|kid)/.test(blob)) {
    hints.push("子育て環境（公園・保育園・幼稚園・小学校）を重視");
  }
  if (/(ペット|犬|猫|pet|dog|cat)/.test(blob)) {
    hints.push("ペットを飼っている可能性あり");
  }
  if (/(自転車|チャリ|bike|bicycle)/.test(blob)) {
    hints.push("自転車での生活を想定");
  }
  if (stationMinutes === 0 || stationMinutes >= 15) {
    hints.push("駅から遠い物件のため、バス・自転車での移動手段や周辺の生活施設の充実度を補足");
  }
  return hints;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      extracted: ExtractedProperty;
      costs?: CostItem[];
      monthlyCosts?: MonthlyItem[];
      language: Language;
      customerId?: string;
    };

    const { extracted, costs = [], monthlyCosts = [], language, customerId } = body;

    if (!extracted) {
      return Response.json({ error: "物件情報が必要です" }, { status: 400 });
    }

    const [nearby, customer] = await Promise.all([
      fetchNearby(extracted.address || extracted.propertyName),
      customerId ? fetchCustomer(customerId) : Promise.resolve(null),
    ]);

    const totalCost = costs.reduce((s, c) => s + c.amount, 0);
    const monthlyTotal = monthlyCosts.find((m) => m.id === "monthly_total")?.amount ?? 0;
    const langName = LANG_NAMES[language] ?? LANG_NAMES.en;
    const nearbyText = formatNearby(nearby);
    const stationMinutes = nearby?.stations[0]?.minutes ?? 0;
    const customerHints = analyzeCustomerHints(customer, stationMinutes);

    const customerSection = customer
      ? `【お客様のヒアリング結果（housing-jp LINE経由）】
${JSON.stringify(customer, null, 2)}

【強調すべきポイント】
${customerHints.length > 0 ? customerHints.map((h) => `- ${h}`).join("\n") : "（特になし。一般的な暮らしやすさを伝える）"}`
      : `【お客様情報】
（ヒアリング情報なし。一般的な暮らしやすさが伝わるコメントにする）`;

    const prompt = `あなたは賃貸物件を扱う日本の不動産仲介担当者です。お客様が「ここで本当に生活できるか」を一番の不安に感じている前提で、物件の紹介ではなく「生活のリアルなイメージ」が伝わる担当者コメントを書いてください。

【物件情報】
物件名: ${extracted.propertyName || "（不明）"}
住所: ${extracted.address || "（不明）"}
間取り: ${extracted.floorPlan || "（不明）"}
面積: ${extracted.area > 0 ? extracted.area + "m²" : "（不明）"}
家賃: ${extracted.rent > 0 ? extracted.rent.toLocaleString("ja-JP") + "円" : "（不明）"}
管理費: ${extracted.managementFee > 0 ? extracted.managementFee.toLocaleString("ja-JP") + "円" : "（不明）"}
初期費用合計: ${totalCost > 0 ? totalCost.toLocaleString("ja-JP") + "円" : "（未計算）"}
月額合計: ${monthlyTotal > 0 ? monthlyTotal.toLocaleString("ja-JP") + "円" : "（未計算）"}

【周辺施設（徒歩分数は直線距離からの目安）】
${nearbyText}

${customerSection}

【コメントの構成（3〜4文）】
1文目：この物件の一番のセールスポイント（間取り・面積・立地のいずれか1つ、具体的に）
2文目：交通アクセス。最寄り駅と徒歩分数を1つだけ具体的に書く。駅が遠い（15分以上）ならバス停や自転車での移動を補足
3文目：生活施設。お客様のヒアリング情報があれば、それに合わせて強調する施設を変える（例：子育て重視→公園・小学校、駐車場希望→車での移動と周辺の道路状況、駅が遠い→近所のスーパー・ドラッグストア）。具体名を1〜2件
4文目：担当者としての一言。押し付けがましくならず、内見や相談を促す程度

【ルール】
- まず日本語で3〜4文のコメントを書く
- 次に${langName}で同じ趣旨を3〜4文で書く
- 出力フォーマット：日本語文を書いた後、空行（改行2つ）を入れて、${langName}の文を書く
- 「外国人」「はじめて日本で」のような言い回しは絶対に使わない。お客様は日本で暮らす一般の方として書く
- 「不動産の説明」ではなく「生活のリアルなイメージ」を伝える。「駅近で便利」のような抽象表現ではなく、具体的な施設名や徒歩分数で書く
- 数字（家賃や初期費用の具体額）はコメント本文で繰り返さない
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
      usedCustomerData: customer !== null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラーが発生しました";
    console.error("[/api/generate-comment]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
