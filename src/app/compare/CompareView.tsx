"use client";

import { useState } from "react";
import type {
  AnalyzeResponse, Language, NearbyPlace, NearbyResult,
} from "@/types";
import { T, LANGS, COST_LABELS, MONTHLY_LABELS } from "@/lib/translations";

export type CompareEntry = {
  slug: string;
  name: string;
  result: AnalyzeResponse;
  nearby?: NearbyResult;
  photoUrls?: string[];
};

const yen = (n: number) => `¥${(n ?? 0).toLocaleString("ja-JP")}`;

const COST_IDS = [
  "rent_first", "deposit", "key_money", "agency_fee",
  "guarantee_fee", "fire_insurance", "key_exchange", "cleaning",
] as const;

const NEARBY_ROWS: { key: keyof NearbyResult; tKey: string }[] = [
  { key: "supermarkets",       tKey: "supermarket" },
  { key: "convenienceStores",  tKey: "convenienceStore" },
  { key: "drugstores",         tKey: "drugstore" },
  { key: "parks",              tKey: "park" },
  { key: "elementarySchools",  tKey: "elementarySchool" },
];

function getCost(entry: CompareEntry, id: string): number {
  return entry.result.costs.find((c) => c.id === id)?.amount ?? 0;
}
function getMonthly(entry: CompareEntry, id: string): number {
  return entry.result.monthlyCosts.find((c) => c.id === id)?.amount ?? 0;
}

function tr(lang: Language, key: string, fallback: string): string {
  return T[lang]?.[key] ?? T.ja?.[key] ?? fallback;
}

function walkMinutes(lang: Language, minutes: number): string {
  if (minutes <= 0) return "";
  const prefix = T[lang]?.walkMinutesPrefix ?? "徒歩";
  const suffix = T[lang]?.walkMinutesSuffix ?? "分";
  return `${prefix}${minutes}${suffix}`;
}

function formatStation(entry: CompareEntry, lang: Language): string {
  const ext = entry.result.extracted;
  const name = ext.nearestStation || entry.nearby?.stations?.[0]?.name;
  if (!name) return "—";
  const min = ext.stationWalkMinutes ?? entry.nearby?.stations?.[0]?.minutes ?? 0;
  const walk = walkMinutes(lang, min);
  return walk ? `${name}（${walk}）` : name;
}

function formatFacilities(entry: CompareEntry): string {
  const list = entry.result.extracted.facilities ?? [];
  return list.length > 0 ? list.join("、") : "—";
}

function formatRecommend(entry: CompareEntry): string {
  return (entry.result.extracted.recommendPoint ?? "").trim() || "—";
}

function firstPlace(places: NearbyPlace[] | undefined, lang: Language): string {
  const p = places?.[0];
  if (!p) return "—";
  const walk = walkMinutes(lang, p.minutes);
  return walk ? `${p.name}（${walk}）` : p.name;
}

const hasAnyNearby = (entries: CompareEntry[]) => entries.some((e) => !!e.nearby);

// COST_LABELS / MONTHLY_LABELS は { ja, en, zh, ... } 多言語マップを持つ
function costLabel(id: string, lang: Language): string {
  const ml = COST_LABELS[id];
  if (!ml) return id;
  return ml[lang] || ml.ja;
}
function monthlyLabel(id: string, lang: Language): string {
  const ml = MONTHLY_LABELS[id];
  if (!ml) return id;
  return ml[lang] || ml.ja;
}

export default function CompareView({
  entries, initialLang,
}: {
  entries: CompareEntry[];
  initialLang: Language;
}) {
  const [lang, setLang] = useState<Language>(initialLang);

  const title = tr(lang, "compareTitle", "物件比較表");
  const propertyN = tr(lang, "propertyN", "物件");
  const propInfo = tr(lang, "propertyInfo", "物件情報");
  const monthlyTitle = tr(lang, "monthlyPayment", "毎月の支払い");
  const initialTitle = tr(lang, "initial", "初期費用");
  const totalInit = tr(lang, "totalInit", "初期費用合計");
  const monthlyTotalLabel = tr(lang, "monthlyTotal", "月額合計");
  const nearbyTitle = tr(lang, "nearbyFacilities", "周辺施設");
  const selectLanguage = tr(lang, "selectLanguage", "言語");
  const showNearby = hasAnyNearby(entries);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#f7f9f4] border-b border-[#dce8d4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-[#2d5e3a] rounded-[9px] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h18M3 14h18M3 6h18M3 18h18" />
              </svg>
            </div>
            <h1 className="text-[15px] font-medium text-[#1a2e20] truncate">{title}</h1>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#5a7a62]">
            <span>{selectLanguage}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              className="border border-[#dce8d4] rounded-md px-2 py-1 bg-white text-[#1a2e20] text-sm"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-36 sticky left-0 bg-slate-50 z-10">
                    {tr(lang, "colItem", "項目")}
                  </th>
                  {entries.map((e, i) => (
                    <th key={e.slug} className="text-center px-4 py-3 text-xs font-semibold text-slate-700 min-w-[160px]">
                      <div className={[
                        "inline-block text-xs px-2 py-0.5 rounded-full mb-1",
                        i === 0 ? "bg-blue-100 text-blue-700"
                          : i === 1 ? "bg-emerald-100 text-emerald-700"
                          : i === 2 ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700",
                      ].join(" ")}>
                        {propertyN}{i + 1}
                      </div>
                      <p className="truncate max-w-[160px] mx-auto">{e.name}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 物件情報 */}
                <SectionRow label={propInfo} colCount={entries.length} />
                <Row label={tr(lang, "address", "住所")}
                  values={entries.map((e) => e.result.extracted.address || "—")} isText />
                <Row label={tr(lang, "roomNumber", "部屋番号")}
                  values={entries.map((e) => e.result.extracted.roomNumber || "—")} isText />
                <Row label={tr(lang, "floorPlan", "間取り")}
                  values={entries.map((e) => e.result.extracted.floorPlan || "—")} isText />
                <Row label={tr(lang, "area", "面積")}
                  values={entries.map((e) => e.result.extracted.area > 0 ? `${e.result.extracted.area} m²` : "—")} isText />
                <Row label={tr(lang, "buildingAge", "築年数")}
                  values={entries.map((e) => e.result.extracted.buildingAge || "—")} isText />
                <Row label={tr(lang, "nearestStation", "最寄り駅")}
                  values={entries.map((e) => formatStation(e, lang))} isText />
                <Row label={tr(lang, "facilities", "設備")}
                  values={entries.map(formatFacilities)} isText wrap />
                <Row label={tr(lang, "recommendPoint", "おすすめポイント")}
                  values={entries.map(formatRecommend)} isText wrap />

                {showNearby && (
                  <>
                    <SectionRow label={nearbyTitle} colCount={entries.length} />
                    {NEARBY_ROWS.map(({ key, tKey }) => (
                      <Row
                        key={key}
                        label={tr(lang, tKey, key as string)}
                        values={entries.map((e) => firstPlace(e.nearby?.[key], lang))}
                        isText
                      />
                    ))}
                  </>
                )}

                {/* 月額 */}
                <SectionRow label={monthlyTitle} colCount={entries.length} />
                <Row label={monthlyLabel("monthly_rent", lang)}
                  values={entries.map((e) => getMonthly(e, "monthly_rent"))} />
                <Row label={monthlyLabel("monthly_mgmt", lang)}
                  values={entries.map((e) => getMonthly(e, "monthly_mgmt"))} />
                <Row label={monthlyTotalLabel}
                  values={entries.map((e) => getMonthly(e, "monthly_total"))} isBold />

                {/* 初期費用 */}
                <SectionRow label={initialTitle} colCount={entries.length} />
                {COST_IDS.map((id) => (
                  <Row key={id} label={costLabel(id, lang)}
                    values={entries.map((e) => getCost(e, id))} />
                ))}
                <Row label={totalInit}
                  values={entries.map((e) => e.result.totalCost)} isBold highlight />
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-[#7a9e82] text-center mt-4">
          {tr(lang, "poweredBy", "realpro")}
        </p>
      </main>
    </div>
  );
}

function SectionRow({ label, colCount }: { label: string; colCount: number }) {
  return (
    <tr className="bg-blue-50 border-t border-b border-blue-200">
      <td colSpan={colCount + 1} className="px-4 py-2 text-xs font-semibold text-blue-700 uppercase tracking-wide sticky left-0 bg-blue-50 z-10">
        {label}
      </td>
    </tr>
  );
}

function minIdx(values: number[]): number {
  const valid = values.filter((v) => v > 0);
  if (valid.length < 2) return -1;
  const min = Math.min(...valid);
  return values.indexOf(min);
}

function Row({
  label, values, isText = false, isBold = false, highlight = false, wrap = false,
}: {
  label: string;
  values: (number | string)[];
  isText?: boolean;
  isBold?: boolean;
  highlight?: boolean;
  wrap?: boolean;
}) {
  const nums = isText ? [] : (values as number[]);
  const lowestIdx = highlight ? minIdx(nums) : -1;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className={`px-4 py-2.5 text-slate-600 align-top sticky left-0 bg-white z-10 ${isBold ? "font-bold" : ""}`}>
        {label}
      </td>
      {values.map((v, i) => {
        const isLowest = lowestIdx === i;
        const isEmpty = isText ? v === "—" : (v as number) === 0;
        return (
          <td
            key={i}
            className={[
              "px-4 py-2.5 align-top",
              isText ? (wrap ? "text-left whitespace-pre-wrap leading-relaxed" : "text-center") : "text-center font-mono",
              isBold ? "font-bold text-base" : "",
              isLowest ? "text-emerald-700 bg-emerald-50 font-bold" : "",
              isEmpty ? "text-slate-300" : "text-slate-800",
            ].join(" ")}
          >
            {isText
              ? v
              : (v as number) === 0
              ? "—"
              : <>{yen(v as number)}{isLowest && <span className="ml-1 text-xs">✓</span>}</>
            }
          </td>
        );
      })}
    </tr>
  );
}
