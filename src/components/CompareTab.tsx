"use client";

import { useState } from "react";
import type { NearbyPlace, NearbyResult, SavedEstimate } from "@/types";

interface Props {
  estimates: SavedEstimate[];
}

const fmt = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

const COST_IDS = [
  { id: "rent_first",    label: "前家賃" },
  { id: "deposit",       label: "敷金" },
  { id: "key_money",     label: "礼金" },
  { id: "agency_fee",    label: "仲介手数料" },
  { id: "guarantee_fee", label: "保証会社利用料" },
  { id: "fire_insurance",label: "火災保険料（2年）" },
  { id: "key_exchange",  label: "鍵交換費用" },
  { id: "cleaning",      label: "室内消毒・除菌" },
];

function getCost(est: SavedEstimate, id: string): number {
  return est.result.costs.find((c) => c.id === id)?.amount ?? 0;
}
function getMonthly(est: SavedEstimate, id: string): number {
  return est.result.monthlyCosts.find((c) => c.id === id)?.amount ?? 0;
}

function minIdx(values: number[]): number {
  const valid = values.filter((v) => v > 0);
  if (valid.length < 2) return -1;
  const min = Math.min(...valid);
  return values.indexOf(min);
}

// 最寄り駅＋徒歩分数を1行にまとめる（手入力 or AI抽出値を優先、なければnearbyの最寄り駅）
function formatStation(est: SavedEstimate): string {
  const ext = est.result.extracted;
  if (ext.nearestStation) {
    const min = ext.stationWalkMinutes ?? 0;
    return min > 0 ? `${ext.nearestStation}（徒歩${min}分）` : ext.nearestStation;
  }
  const first = est.nearby?.stations?.[0];
  if (first) {
    return first.minutes > 0 ? `${first.name}（徒歩${first.minutes}分）` : first.name;
  }
  return "—";
}

function formatFacilities(est: SavedEstimate): string {
  const list = est.result.extracted.facilities ?? [];
  return list.length > 0 ? list.join("、") : "—";
}

function formatRecommend(est: SavedEstimate): string {
  return (est.result.extracted.recommendPoint ?? "").trim() || "—";
}

// nearby から代表1件を「名称（徒歩X分）」で取り出す
function firstPlace(places: NearbyPlace[] | undefined): string {
  const p = places?.[0];
  if (!p) return "—";
  return p.minutes > 0 ? `${p.name}（徒歩${p.minutes}分）` : p.name;
}

const NEARBY_ROWS: { label: string; key: keyof NearbyResult }[] = [
  { label: "スーパー",       key: "supermarkets" },
  { label: "コンビニ",       key: "convenienceStores" },
  { label: "ドラッグストア", key: "drugstores" },
  { label: "公園",           key: "parks" },
  { label: "小学校",         key: "elementarySchools" },
];

const hasAnyNearby = (estimates: SavedEstimate[]) => estimates.some((e) => !!e.nearby);

export default function CompareTab({ estimates }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [shareIsError, setShareIsError] = useState(false);

  const toggle = (id: string) => {
    setComparing(false);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const selectedEstimates = selected.map((id) => estimates.find((e) => e.id === id)!).filter(Boolean);

  const handleCopyCompareUrl = async () => {
    if (selectedEstimates.length < 2 || shareBusy) return;
    setShareBusy(true);
    setShareMsg(null);
    setShareIsError(false);
    try {
      const slugs: string[] = [];
      for (const est of selectedEstimates) {
        const payload = {
          result: est.result,
          agentInfo: est.agentInfo,
          customerInfo: est.customerInfo,
          comment: est.comment,
          nearby: est.nearby,
        };
        const res = await fetch("/api/estimates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.slug) {
          throw new Error(data.error ?? "URLの生成に失敗しました");
        }
        slugs.push(data.slug as string);
      }
      const base = typeof window !== "undefined"
        ? window.location.origin
        : "https://realpro-one.vercel.app";
      const url = `${base}/compare?s=${slugs.join(",")}`;
      await navigator.clipboard.writeText(url);
      setShareMsg("コピーしました！");
      setTimeout(() => setShareMsg(null), 2000);
    } catch (err) {
      setShareIsError(true);
      setShareMsg(err instanceof Error ? err.message : "失敗しました");
      setTimeout(() => setShareMsg(null), 3000);
    } finally {
      setShareBusy(false);
    }
  };

  if (estimates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm font-medium">保存済みの見積もりがありません</p>
        <p className="text-xs mt-1">新規見積もりタブで保存すると、ここで比較できます</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 物件選択 */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">比較する物件を選択</h3>
            <p className="text-xs text-slate-400 mt-0.5">最大3件まで選択できます（現在 {selected.length} 件）</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {selected.length >= 2 && (
              <button
                onClick={() => setComparing(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                比較表を作成
              </button>
            )}
            {selected.length >= 2 && (
              <button
                onClick={handleCopyCompareUrl}
                disabled={shareBusy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-[#2d5e3a] text-white hover:bg-[#23472b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.828 10.172a4 4 0 015.656 5.656l-3 3a4 4 0 01-5.656 0M10.172 13.828a4 4 0 01-5.656-5.656l3-3a4 4 0 015.656 0" />
                </svg>
                {shareBusy ? "生成中…" : "比較表URLをコピー"}
              </button>
            )}
            {shareMsg && (
              <span className={[
                "text-xs",
                shareIsError ? "text-red-600" : "text-emerald-700",
              ].join(" ")}>
                {shareMsg}
              </span>
            )}
            {comparing && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-slate-700 text-white hover:bg-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                印刷
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {estimates.map((est) => {
            const isSelected = selected.includes(est.id);
            const isDisabled = !isSelected && selected.length >= 3;
            return (
              <label
                key={est.id}
                className={[
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                  isSelected
                    ? "border-blue-400 bg-blue-50"
                    : isDisabled
                    ? "border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed"
                    : "border-slate-200 hover:border-blue-300 hover:bg-slate-50",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => !isDisabled && toggle(est.id)}
                  className="mt-0.5 accent-blue-600"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{est.name}</p>
                  <p className="text-xs text-slate-400 truncate">{est.result.extracted.address || "住所なし"}</p>
                  <p className="text-xs text-blue-700 font-mono mt-1">
                    初期 {fmt(est.result.totalCost)}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* 比較表 */}
      {comparing && selectedEstimates.length >= 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* 印刷タイトル */}
          <div className="hidden print:block px-6 pt-5 pb-3 border-b border-slate-200">
            <h1 className="text-xl font-bold text-slate-900">物件比較表</h1>
            <p className="text-xs text-slate-500 mt-1">作成日: {new Date().toLocaleDateString("ja-JP")}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-36">項目</th>
                  {selectedEstimates.map((est, i) => (
                    <th key={est.id} className="text-center px-4 py-3 text-xs font-semibold text-slate-700 min-w-[140px]">
                      <div className={[
                        "inline-block text-xs px-2 py-0.5 rounded-full mb-1",
                        i === 0 ? "bg-blue-100 text-blue-700" : i === 1 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                      ].join(" ")}>
                        物件{i + 1}
                      </div>
                      <p className="truncate max-w-[140px] mx-auto">{est.name}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 物件情報 */}
                <SectionRow label="物件情報" colCount={selectedEstimates.length} />
                <CompRow label="住所" values={selectedEstimates.map((e) => e.result.extracted.address || "—")} isText />
                <CompRow label="部屋番号" values={selectedEstimates.map((e) => e.result.extracted.roomNumber || "—")} isText />
                <CompRow label="間取り" values={selectedEstimates.map((e) => e.result.extracted.floorPlan || "—")} isText />
                <CompRow label="面積" values={selectedEstimates.map((e) => e.result.extracted.area > 0 ? `${e.result.extracted.area} m²` : "—")} isText />
                <CompRow label="築年数" values={selectedEstimates.map((e) => e.result.extracted.buildingAge || "—")} isText />
                <CompRow label="最寄り駅" values={selectedEstimates.map(formatStation)} isText />
                <CompRow label="設備" values={selectedEstimates.map(formatFacilities)} isText wrap />
                <CompRow label="おすすめポイント" values={selectedEstimates.map(formatRecommend)} isText wrap />

                {/* 周辺施設（コメント生成済みの物件のみデータあり） */}
                {hasAnyNearby(selectedEstimates) && (
                  <>
                    <SectionRow label="周辺施設（担当者コメント生成時に取得）" colCount={selectedEstimates.length} />
                    {NEARBY_ROWS.map(({ label, key }) => (
                      <CompRow
                        key={key}
                        label={label}
                        values={selectedEstimates.map((e) => firstPlace(e.nearby?.[key]))}
                        isText
                      />
                    ))}
                  </>
                )}

                {/* 月額 */}
                <SectionRow label="毎月の支払い" colCount={selectedEstimates.length} />
                <CompRow label="家賃" values={selectedEstimates.map((e) => getMonthly(e, "monthly_rent"))} />
                <CompRow label="管理費" values={selectedEstimates.map((e) => getMonthly(e, "monthly_mgmt"))} />
                <CompRow label="月額合計" values={selectedEstimates.map((e) => getMonthly(e, "monthly_total"))} isBold />

                {/* 初期費用 */}
                <SectionRow label="初期費用" colCount={selectedEstimates.length} />
                {COST_IDS.map(({ id, label }) => (
                  <CompRow key={id} label={label} values={selectedEstimates.map((e) => getCost(e, id))} />
                ))}
                <CompRow label="初期費用合計" values={selectedEstimates.map((e) => e.result.totalCost)} isBold highlight />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionRow({ label, colCount }: { label: string; colCount: number }) {
  return (
    <tr className="bg-blue-50 border-t border-b border-blue-200">
      <td colSpan={colCount + 1} className="px-4 py-2 text-xs font-semibold text-blue-700 uppercase tracking-wide">
        {label}
      </td>
    </tr>
  );
}

function CompRow({
  label,
  values,
  isText = false,
  isBold = false,
  highlight = false,
  wrap = false,
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
      <td className={`px-4 py-2.5 text-slate-600 align-top ${isBold ? "font-bold" : ""}`}>{label}</td>
      {values.map((v, i) => {
        const isLowest = lowestIdx === i;
        const isEmpty = isText ? v === "—" : (v as number) === 0;
        return (
          <td
            key={i}
            className={[
              "px-4 py-2.5 align-top",
              isText ? "" : "text-center font-mono",
              isText && wrap ? "text-left whitespace-pre-wrap leading-relaxed" : "text-center",
              isBold ? "font-bold text-base" : "",
              isLowest ? "text-emerald-700 bg-emerald-50 font-bold" : "",
              isEmpty ? "text-slate-300" : "text-slate-800",
            ].join(" ")}
          >
            {isText
              ? v
              : (v as number) === 0
              ? "—"
              : <>{fmt(v as number)}{isLowest && <span className="ml-1 text-xs">✓最安</span>}</>
            }
          </td>
        );
      })}
    </tr>
  );
}
