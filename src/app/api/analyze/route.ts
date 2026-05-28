import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import type { AnalyzeResponse, CostItem, ExtractedProperty, MonthlyItem } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type ValidMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const ALLOWED_TYPES: ValidMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Stage 1: 複数画像を一括送信して物件情報を抽出
async function extractPropertyData(
  images: Array<{ data: string; mediaType: ValidMediaType }>
): Promise<ExtractedProperty> {
  const imageBlocks = images.map((img) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
  }));

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: `これらの不動産物件の画像（${images.length}枚）から以下の情報をJSON形式で抽出してください。
複数枚ある場合は情報を統合し、より詳細な値を優先してください。
数値は円単位の整数で返してください（万円表記なら10000倍）。
不明な項目は数値なら0、文字列なら空文字、配列なら空配列にしてください。

{
  "propertyName": "物件名",
  "address": "住所",
  "rent": 家賃（円）,
  "managementFee": 管理費（円）,
  "deposit": 敷金（円）,
  "keyMoney": 礼金（円）,
  "floorPlan": "間取り（例: 1LDK）",
  "area": 面積（m²の数値のみ）,
  "fireInsuranceMonthly": 火災保険の月額（円）※月払いの場合のみ、一括払いや不明なら0,
  "guaranteeFeeMonthly": 月額保証料（円）※毎月請求される保証料のみ、初回一括なら0,
  "addressRomaji": "住所のローマ字・英語表記（例: 2-113 Shinkaichō, Tokoname-shi, Aichi-ken）※番地はハイフン区切り・丁目は数字のみ・市区町村にサフィックス付与",
  "roomNumber": "部屋番号（例: 101号室）※画像に明記されていれば抽出、なければ空文字",
  "buildingAge": "築年数（例: 築15年 / 新築 / 築浅）※画像に書いてあれば抽出、なければ空文字",
  "nearestStation": "最寄り駅（例: 新開町駅）※路線名や複数駅があれば最も近い1駅のみ。なければ空文字",
  "stationWalkMinutes": 最寄り駅までの徒歩分数（整数）※画像に書いてあれば抽出、なければ0,
  "facilities": ["設備の配列。以下から該当するものだけ含める。なければ空配列",
                 "オートロック", "宅配BOX", "バストイレ別", "追い焚き", "独立洗面台",
                 "エアコン", "室内洗濯機置場", "モニター付インターホン", "2階以上",
                 "南向き", "駐車場あり", "ペット可", "楽器可"]
}

facilitiesの注意：上のリストはあくまで候補です。画像から確認できたものだけを配列に含めてください。確認できないものは絶対に含めないでください。リストに無い設備も画像にあれば自由に追加して構いません。

JSONのみ返してください。`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("物件情報の抽出に失敗しました");

  const raw = JSON.parse(match[0]);
  const facilities = Array.isArray(raw.facilities)
    ? raw.facilities.filter((f: unknown): f is string => typeof f === "string" && f.trim().length > 0)
    : [];
  return {
    propertyName: raw.propertyName ?? "",
    address: raw.address ?? "",
    rent: Number(raw.rent) || 0,
    managementFee: Number(raw.managementFee) || 0,
    deposit: Number(raw.deposit) || 0,
    keyMoney: Number(raw.keyMoney) || 0,
    floorPlan: raw.floorPlan ?? "",
    area: Number(raw.area) || 0,
    fireInsuranceMonthly: Number(raw.fireInsuranceMonthly) || 0,
    guaranteeFeeMonthly: Number(raw.guaranteeFeeMonthly) || 0,
    addressRomaji: raw.addressRomaji ?? "",
    roomNumber: raw.roomNumber ?? "",
    buildingAge: raw.buildingAge ?? "",
    nearestStation: raw.nearestStation ?? "",
    stationWalkMinutes: Number(raw.stationWalkMinutes) || 0,
    facilities,
    recommendPoint: "",
  };
}

// Stage 2-a: 初期費用を固定ルールで計算
function calculateInitialCosts(prop: ExtractedProperty): CostItem[] {
  const monthlyBase = prop.rent + prop.managementFee;

  // 火災保険：月額が読み取れれば×24、なければ固定20,000円
  const fireInsurance =
    prop.fireInsuranceMonthly > 0 ? prop.fireInsuranceMonthly * 24 : 20000;
  const fireNote =
    prop.fireInsuranceMonthly > 0
      ? `月額 ${prop.fireInsuranceMonthly.toLocaleString("ja-JP")}円 × 24ヶ月`
      : "2年契約の目安（月額不明）";

  return [
    {
      id: "rent_first",
      category: "家賃関連",
      label: "前家賃",
      amount: monthlyBase,
      note: "入居月の家賃・管理費",
      editable: true,
    },
    {
      id: "deposit",
      category: "家賃関連",
      label: "敷金",
      amount: prop.deposit,
      note: "退去時に精算",
      editable: true,
    },
    {
      id: "key_money",
      category: "家賃関連",
      label: "礼金",
      amount: prop.keyMoney,
      note: "返還なし",
      editable: true,
    },
    {
      id: "agency_fee",
      category: "仲介費用",
      label: "仲介手数料",
      amount: Math.round(monthlyBase * 1.1),
      note: "家賃1ヶ月分＋消費税10%",
      editable: true,
    },
    {
      id: "guarantee_fee",
      category: "保証・保険",
      label: "保証会社利用料",
      amount: Math.round(monthlyBase * 0.5),
      note: "家賃0.5ヶ月分（目安）",
      editable: true,
    },
    {
      id: "fire_insurance",
      category: "保証・保険",
      label: "火災保険料（2年）",
      amount: fireInsurance,
      note: fireNote,
      editable: true,
    },
    {
      id: "key_exchange",
      category: "入居費用",
      label: "鍵交換費用",
      amount: 16500,
      note: "税込",
      editable: true,
    },
    {
      id: "cleaning",
      category: "入居費用",
      label: "室内消毒・除菌",
      amount: 16500,
      note: "任意（要確認）",
      editable: true,
    },
  ];
}

// Stage 2-b: 月額費用を計算（家賃・管理費・月額保証料は常に3行返す。値がなければ0）
function calculateMonthlyCosts(prop: ExtractedProperty): MonthlyItem[] {
  const items: MonthlyItem[] = [
    { id: "monthly_rent",      label: "家賃",       amount: prop.rent,                editable: true },
    { id: "monthly_mgmt",      label: "管理費",     amount: prop.managementFee,       editable: true },
    { id: "monthly_guarantee", label: "月額保証料", amount: prop.guaranteeFeeMonthly, editable: true },
  ];

  const total = items.reduce((s, i) => s + i.amount, 0);
  items.push({ id: "monthly_total", label: "月額合計", amount: total, editable: false });

  return items;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("image") as File[];

    if (files.length === 0) {
      return Response.json({ error: "画像ファイルが必要です" }, { status: 400 });
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type as ValidMediaType)) {
        return Response.json(
          { error: `${file.name}: JPEG / PNG / GIF / WebP のみ対応しています` },
          { status: 400 }
        );
      }
    }

    const images = await Promise.all(
      files.map(async (file) => ({
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mediaType: file.type as ValidMediaType,
      }))
    );

    // Stage 1: 全画像を一括解析
    const extracted = await extractPropertyData(images);

    // Stage 2: 固定ルールで計算
    const costs = calculateInitialCosts(extracted);
    const monthlyCosts = calculateMonthlyCosts(extracted);
    const totalCost = costs.reduce((s, c) => s + c.amount, 0);

    const response: AnalyzeResponse = { extracted, costs, totalCost, monthlyCosts };
    return Response.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラーが発生しました";
    console.error("[/api/analyze]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
