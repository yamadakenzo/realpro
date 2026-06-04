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

★最重要ルール（必ず守る）★
1. 画像に書いてある金額だけを、書いてある通りの数字で返す。推測・概算・目安で数字を作らない（金額の計算もしない）。
2. 画像に載っていない費用項目は絶対に作らない（存在しない費用を勝手に追加しない）。
3. 「賃料（家賃）」と「管理費・共益費」は必ず別々の数値で返す。一緒にしない（後で仲介手数料の計算に使うため）。
4. 「諸費用」「ランニングコスト」「その他」「初期費用」などの欄に書いてある費用は、1つも取りこぼさず全部拾う。定番項目に当てはまらないものは otherInitialCosts / otherMonthlyCosts に入れる。

{
  "propertyName": "物件名",
  "address": "住所",
  "rent": 賃料・家賃（円）※「賃料」「家賃」の金額のみ。管理費・共益費は絶対にここに含めない,
  "managementFee": 管理費・共益費（円）※「管理費」「共益費」の金額。賃料とは必ず分けて返す。両方あれば合算。なければ0,
  "deposit": 敷金（円）,
  "keyMoney": 礼金（円）,
  "floorPlan": "間取り（例: 1LDK）",
  "area": 面積（m²の数値のみ）,
  "fireInsuranceTotal": 火災保険料の総額（円）※「2年で18,000円」のように一括・総額で書いてあればその金額。月額しか無い・書いていなければ0,
  "fireInsuranceMonthly": 火災保険の月額（円）※月払い金額が書いてある場合のみ。総額しか無い・不明なら0,
  "guaranteeFeeMonthly": 月額保証料（円）※毎月請求される保証料のみ、初回一括なら0,
  "addressRomaji": "住所のローマ字・英語表記（例: 2-113 Shinkaichō, Tokoname-shi, Aichi-ken）※番地はハイフン区切り・丁目は数字のみ・市区町村にサフィックス付与",
  "roomNumber": "部屋番号（例: 101号室）※画像に明記されていれば抽出、なければ空文字",
  "buildingAge": "築年数（例: 築15年 / 新築 / 築浅）※画像に書いてあれば抽出、なければ空文字",
  "nearestStation": "最寄り駅（例: 新開町駅）※路線名や複数駅があれば最も近い1駅のみ。なければ空文字",
  "stationWalkMinutes": 最寄り駅までの徒歩分数（整数）※画像に書いてあれば抽出、なければ0,
  "facilities": ["設備の配列。以下から該当するものだけ含める。なければ空配列",
                 "オートロック", "宅配BOX", "バストイレ別", "追い焚き", "独立洗面台",
                 "エアコン", "室内洗濯機置場", "モニター付インターホン", "2階以上",
                 "南向き", "駐車場あり", "ペット可", "楽器可"],
  "otherInitialCosts": [ { "label": "費用名（書いてある通り）", "amount": 金額（円） } ],
  "otherMonthlyCosts":  [ { "label": "費用名（書いてある通り）", "amount": 金額（円） } ]
}

facilitiesの注意：上のリストはあくまで候補です。画像から確認できたものだけを配列に含めてください。確認できないものは絶対に含めないでください。リストに無い設備も画像にあれば自由に追加して構いません。

otherInitialCosts の注意：「初期費用」欄に書いてあって、敷金・礼金・前家賃・仲介手数料・保証会社利用料・火災保険料・鍵交換 のどれにも当てはまらない費用を全て入れる（例：修理分担金、書類作成料、保険事務手数料 など）。当てはまる定番費用はここに入れず、上の決まった項目に入れる。何も無ければ空配列。

otherMonthlyCosts の注意：賃料・管理費・共益費・月額保証料 以外で毎月かかる費用を全て入れる（例：CATV費用、水道料金、駆け付けサービス〔アプリコール24 等〕、町内会費）。何も無ければ空配列。

どちらの配列も、画像に金額が書いてある費用だけを入れること。書いていない費用を想像で足さない。

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

  // 画像に書いてあった「その他費用」を、ラベルあり・金額>0 のものだけに整える
  const sanitizeExtraCosts = (
    arr: unknown
  ): { label: string; amount: number }[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((c) => ({
        label: typeof c?.label === "string" ? c.label.trim() : "",
        amount: Number(c?.amount) || 0,
      }))
      .filter((c) => c.label.length > 0 && c.amount > 0);
  };

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
    fireInsuranceTotal: Number(raw.fireInsuranceTotal) || 0,
    guaranteeFeeMonthly: Number(raw.guaranteeFeeMonthly) || 0,
    otherInitialCosts: sanitizeExtraCosts(raw.otherInitialCosts),
    otherMonthlyCosts: sanitizeExtraCosts(raw.otherMonthlyCosts),
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
// 大方針：金額の計算（掛け算・足し算・ヶ月→金額の変換）はすべてここコード側で確定的に行う。
//        AIは「画像に書いてある数字」を渡すだけで、計算・推測はさせない。
function calculateInitialCosts(prop: ExtractedProperty): CostItem[] {
  // 仲介手数料は「賃料のみ（管理費・共益費を除く）× 1.1」で計算する
  const agencyFee = Math.round(prop.rent * 1.1);
  // 前家賃・保証会社初回は従来どおり「総賃料（賃料＋管理費）」ベース
  const monthlyBase = prop.rent + prop.managementFee;

  // 火災保険：①総額が書いてあればその額をそのまま使う ②月額が書いてあれば×24 ③どちらも無ければ目安20,000円
  let fireInsurance: number;
  let fireNote: string;
  if (prop.fireInsuranceTotal && prop.fireInsuranceTotal > 0) {
    fireInsurance = prop.fireInsuranceTotal;
    fireNote = "マイソク記載の契約金額";
  } else if (prop.fireInsuranceMonthly > 0) {
    fireInsurance = prop.fireInsuranceMonthly * 24;
    fireNote = `月額 ${prop.fireInsuranceMonthly.toLocaleString("ja-JP")}円 × 24ヶ月`;
  } else {
    fireInsurance = 20000;
    fireNote = "2年契約の目安（記載なし）";
  }

  const items: CostItem[] = [
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
      amount: agencyFee,
      note: "賃料1ヶ月分＋消費税10%（管理費は含まない）",
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
  ];

  // マイソクに書いてあった「その他の初期費用」（例：修理分担金）を追加。
  // id を custom_ で始めると CostTable が「ユーザー追加行」として扱い、ラベルも編集可になる。
  (prop.otherInitialCosts ?? []).forEach((c, i) => {
    items.push({
      id: `custom_other_init_${i}`,
      category: "その他費用",
      label: c.label,
      amount: c.amount,
      note: "マイソク記載",
      editable: true,
    });
  });

  return items;
}

// Stage 2-b: 月額費用を計算（家賃・管理費・月額保証料は常に3行返す。値がなければ0）
function calculateMonthlyCosts(prop: ExtractedProperty): MonthlyItem[] {
  const items: MonthlyItem[] = [
    { id: "monthly_rent",      label: "家賃",       amount: prop.rent,                editable: true },
    { id: "monthly_mgmt",      label: "管理費",     amount: prop.managementFee,       editable: true },
    { id: "monthly_guarantee", label: "月額保証料", amount: prop.guaranteeFeeMonthly, editable: true },
  ];

  // マイソクに書いてあった「その他の月額費用」（例：CATV・水道料金・駆け付けサービス）を合計の前に追加。
  // id を monthly_custom_ で始めると CostTable が「ユーザー追加行」として扱い、ラベルも編集可になる。
  (prop.otherMonthlyCosts ?? []).forEach((c, i) => {
    items.push({ id: `monthly_custom_other_${i}`, label: c.label, amount: c.amount, editable: true });
  });

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
