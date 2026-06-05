"use client";

import { useState } from "react";
import {
  COST_LABELS, MONTHLY_LABELS, CAT_LABELS, SECTION,
  PHONETICS, GLOSSARY, T, bilingual, formatAmount, sectionLabel,
  COST_BILINGUAL_KEY, MONTHLY_BILINGUAL_KEY, CAT_BILINGUAL_KEY,
} from "@/lib/translations";
import type { AgentInfo, CostItem, ExtractedProperty, Language, MonthlyItem } from "@/types";

// 物件位置の静的地図（画面・PDF両方に表示）。
// 画像はサーバールート /api/staticmap 経由なので APIキーはHTMLに出ない。
// 住所から座標が取れない等で画像が読めなければ自動で非表示にする（地図セクションごと消す）。
function PropertyMap({ address, label }: { address: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const src = `/api/staticmap?address=${encodeURIComponent(address)}`;
  return (
    <div className="px-6 py-4 border-b border-slate-100">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</h3>
      <img
        src={src}
        alt={label}
        onError={() => setFailed(true)}
        className="w-full h-48 object-cover rounded-lg border border-slate-200"
        style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
      />
    </div>
  );
}

interface Props {
  extracted: ExtractedProperty;
  costs: CostItem[];
  monthlyCosts: MonthlyItem[];
  agentInfo: AgentInfo;
  logoDataUrl: string;
  validUntil: string;
  customerName: string;
  pdfLang: Language;
  showGlossary: boolean;
  photoUrls: string[];
  onCostsChange: (costs: CostItem[]) => void;
  onMonthlyCostsChange: (costs: MonthlyItem[]) => void;
  onRoomNumberChange: (v: string) => void;
}

const fmt = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

// 画面 → 日本語ラベル、印刷 → 「日本語（翻訳）」＋（非ja時のみ）フリガナ
function ItemLabel({
  id,
  fallback,
  labelMap,
  bilingualKey,
  pdfLang,
}: {
  id: string;
  fallback: string;
  labelMap: Record<string, Record<Language, string>>;
  bilingualKey?: string;
  pdfLang: Language;
}) {
  const ph = PHONETICS[id];
  const jaLabel = labelMap[id]?.ja ?? fallback;
  const showFurigana = pdfLang !== "ja";
  const labelText = bilingualKey ? bilingual(jaLabel, bilingualKey, pdfLang) : jaLabel;

  return (
    <>
      {/* 画面：日本語 */}
      <span className="print:hidden">{jaLabel}</span>

      {/* 印刷：「日本語（翻訳）」＋ （非ja時のみ）読み仮名 */}
      <span className="hidden print:inline leading-snug">
        <span className="font-medium">{labelText}</span>
        {ph && showFurigana && (
          <span className="text-slate-500 text-xs">
            {" "}（{ph.furigana} / {ph.romaji}）
          </span>
        )}
      </span>
    </>
  );
}

// 画面 → 円表示、印刷 → 円 + 換算
function AmountDisplay({ amount, pdfLang }: { amount: number; pdfLang: Language }) {
  const { jpy, local } = formatAmount(amount, pdfLang);
  return (
    <>
      {/* 画面 */}
      <span className="print:hidden font-mono">{amount.toLocaleString("ja-JP")}</span>
      {/* 印刷 */}
      <span className="hidden print:inline font-mono text-right">
        {jpy}
        {local && <span className="block text-xs text-slate-500 font-normal">{local}</span>}
      </span>
    </>
  );
}

export default function CostTable({
  extracted, costs, monthlyCosts, agentInfo, logoDataUrl, validUntil,
  customerName,
  pdfLang, showGlossary, photoUrls,
  onCostsChange, onMonthlyCostsChange, onRoomNumberChange,
}: Props) {
  const updateCost = (id: string, value: string) => {
    const amount = Math.max(0, parseInt(value, 10) || 0);
    onCostsChange(costs.map((c) => (c.id === id ? { ...c, amount } : c)));
  };

  const updateCostField = (id: string, field: "label" | "note", value: string) => {
    onCostsChange(costs.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const addCost = () => {
    onCostsChange([
      ...costs,
      {
        id: `custom_${Date.now()}`,
        category: "その他",
        label: "",
        amount: 0,
        note: "",
        editable: true,
      },
    ]);
  };

  const deleteCost = (id: string) => {
    onCostsChange(costs.filter((c) => c.id !== id));
  };

  const updateMonthly = (id: string, value: string) => {
    const amount = Math.max(0, parseInt(value, 10) || 0);
    const updated = monthlyCosts.map((c) => (c.id === id ? { ...c, amount } : c));
    const total = updated.filter((c) => c.id !== "monthly_total").reduce((s, c) => s + c.amount, 0);
    onMonthlyCostsChange(updated.map((c) => (c.id === "monthly_total" ? { ...c, amount: total } : c)));
  };

  const updateMonthlyField = (id: string, value: string) => {
    onMonthlyCostsChange(monthlyCosts.map((c) => (c.id === id ? { ...c, label: value } : c)));
  };

  const addMonthly = () => {
    const newItem: MonthlyItem = {
      id: `monthly_custom_${Date.now()}`,
      label: "",
      amount: 0,
      editable: true,
    };
    const items = [...monthlyCosts.filter((c) => c.id !== "monthly_total"), newItem];
    const total = items.reduce((s, c) => s + c.amount, 0);
    items.push({ id: "monthly_total", label: "月額合計", amount: total, editable: false });
    onMonthlyCostsChange(items);
  };

  const deleteMonthly = (id: string) => {
    if (id === "monthly_total") return;
    const remaining = monthlyCosts.filter((c) => c.id !== id);
    const total = remaining.filter((c) => c.id !== "monthly_total").reduce((s, c) => s + c.amount, 0);
    onMonthlyCostsChange(
      remaining.map((c) => (c.id === "monthly_total" ? { ...c, amount: total } : c))
    );
  };

  const isUserAdded = (id: string) => id.startsWith("custom_") || id.startsWith("monthly_custom_");

  const initialTotal = costs.reduce((s, c) => s + c.amount, 0);
  const categories = [...new Set(costs.map((c) => c.category))];
  const hasAgent = agentInfo.companyName || agentInfo.agentName || agentInfo.phone;
  const glossaryItems = showGlossary ? GLOSSARY[pdfLang] : [];

  return (
    <div id="print-area" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

      {/* ===== 印刷ヘッダー ===== */}
      <div className="hidden print:flex items-start justify-between gap-6 px-6 pt-6 pb-4 border-b border-slate-200">
        {/* 左: ロゴ + 担当者情報 */}
        <div className="flex items-start gap-4">
          {logoDataUrl && (
            <img src={logoDataUrl} alt="logo" className="h-12 w-24 object-contain shrink-0" />
          )}
          {hasAgent && (
            <div className="text-sm text-slate-700 space-y-0.5">
              {agentInfo.companyName && (
                <p className="font-bold text-slate-900 text-base">{agentInfo.companyName}</p>
              )}
              {agentInfo.agentName && (
                <p>{SECTION.agentName[pdfLang]}: <strong>{agentInfo.agentName}</strong></p>
              )}
              {agentInfo.phone && (
                <p>{SECTION.phone[pdfLang]}: <strong>{agentInfo.phone}</strong></p>
              )}
            </div>
          )}
        </div>
        {/* 右: レポートタイトル + 日付 */}
        <div className="text-right shrink-0">
          {customerName && (
            <p className="text-base font-bold text-slate-900">{customerName} 様</p>
          )}
          <h1 className={[
            "font-bold text-slate-900",
            customerName ? "text-lg mt-0.5" : "text-xl",
          ].join(" ")}>
            物件費用見積書
          </h1>
          {pdfLang !== "ja" && T[pdfLang]?.docTitle && (
            <p className="text-[10pt] text-slate-500 leading-tight">{T[pdfLang].docTitle}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            {SECTION.createdDate[pdfLang]}: {new Date().toLocaleDateString("ja-JP")}
          </p>
          {validUntil && (
            <p className="text-xs text-red-600 mt-0.5 font-medium">
              {SECTION.validUntil[pdfLang]}: {new Date(validUntil).toLocaleDateString("ja-JP")}
            </p>
          )}
        </div>
      </div>

      {/* ===== 物件情報 ===== */}
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          <span className="print:hidden">物件情報</span>
          <span className="hidden print:inline">{sectionLabel("propertyInfo", pdfLang)}</span>
        </h3>
        <p className="text-base font-bold text-slate-900">
          {extracted.propertyName || "（物件名不明）"}
          {extracted.roomNumber && (
            <span className="hidden print:inline text-slate-600 font-normal"> {extracted.roomNumber}</span>
          )}
        </p>
        {/* 画面: 部屋番号入力 */}
        <div className="print:hidden mt-1 flex items-center gap-2">
          <label className="text-xs text-slate-400 shrink-0">{SECTION.roomNumber.ja}</label>
          <input
            type="text"
            value={extracted.roomNumber ?? ""}
            onChange={(e) => onRoomNumberChange(e.target.value)}
            placeholder="例: 101号室"
            className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-700 w-36"
          />
        </div>
        {extracted.address && <p className="text-sm text-slate-600 mt-1">{extracted.address}</p>}
        {extracted.addressRomaji && (
          <p className="hidden print:block text-xs text-slate-400 mt-0.5">{extracted.addressRomaji}</p>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-slate-700">
          <span>
            <span className="print:hidden">家賃</span>
            <span className="hidden print:inline">{sectionLabel("rent", pdfLang)}</span>
            {" "}<strong>{fmt(extracted.rent)}</strong>
          </span>
          {extracted.managementFee > 0 && (
            <span>
              <span className="print:hidden">管理費</span>
              <span className="hidden print:inline">{sectionLabel("managementFee", pdfLang)}</span>
              {" "}<strong>{fmt(extracted.managementFee)}</strong>
            </span>
          )}
          {extracted.floorPlan && (
            <span>
              <span className="print:hidden">間取り</span>
              <span className="hidden print:inline">{sectionLabel("floorPlan", pdfLang)}</span>
              {" "}<strong>{extracted.floorPlan}</strong>
            </span>
          )}
          {extracted.area > 0 && (
            <span>
              <span className="print:hidden">面積</span>
              <span className="hidden print:inline">{sectionLabel("area", pdfLang)}</span>
              {" "}<strong>{extracted.area} m²</strong>
            </span>
          )}
        </div>
      </div>

      {/* ===== 物件位置の地図（住所がある時だけ。画面＋PDF。画像はサーバー経由でキー非露出） ===== */}
      {extracted.address && (
        <PropertyMap address={extracted.address} label={sectionLabel("mapTitle", pdfLang)} />
      )}

      {/* ===== セールスポイント（金銭メリット・強い特徴。画面とPDFで目立たせる） ===== */}
      {(extracted.salesPoints?.length ?? 0) > 0 && (
        <div className="px-6 py-4 border-b border-[#dce8d4] bg-[#f3f9ec]">
          <h3 className="text-xs font-bold text-[#2d5e3a] mb-2">
            ✨ {pdfLang === "ja"
              ? "セールスポイント"
              : `セールスポイント / ${T[pdfLang]?.salesPoints ?? "Selling Points"}`}
          </h3>
          <div className="flex flex-wrap gap-2">
            {extracted.salesPoints!.map((sp) => (
              <span
                key={sp}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-[#2d5e3a] text-white"
              >
                {sp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== 初期費用テーブル ===== */}
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          <span className="print:hidden">初期費用</span>
          <span className="hidden print:inline">{sectionLabel("initialCosts", pdfLang)}</span>
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-2/5">
                <span className="print:hidden">項目</span>
                <span className="hidden print:inline">{SECTION.colItem[pdfLang]}</span>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-1/4">
                <span className="print:hidden">金額（円）</span>
                <span className="hidden print:inline">{SECTION.colAmount[pdfLang]}</span>
              </th>
              <th className="hidden sm:table-cell print:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <span className="print:hidden">備考</span>
                <span className="hidden print:inline">{SECTION.colNote[pdfLang]}</span>
              </th>
              <th className="w-12 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) =>
              costs
                .filter((c) => c.category === cat)
                .map((item, idx) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      {idx === 0 && (
                        <span className="inline-block text-xs font-medium text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 mb-1">
                          <span className="print:hidden">{cat}</span>
                          <span className="hidden print:inline">
                            {bilingual(CAT_LABELS[cat]?.ja ?? cat, CAT_BILINGUAL_KEY[cat], pdfLang)}
                          </span>
                        </span>
                      )}
                      <div>
                        {isUserAdded(item.id) ? (
                          <>
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => updateCostField(item.id, "label", e.target.value)}
                              placeholder="項目名"
                              className="print:hidden text-sm w-full border-b border-slate-200 focus:outline-none focus:border-[#2d5e3a] py-0.5 placeholder:text-[#a8c4ae]"
                            />
                            <span className="hidden print:inline font-medium">{item.label || "（項目名未入力）"}</span>
                          </>
                        ) : (
                          <ItemLabel
                            id={item.id}
                            fallback={item.label}
                            labelMap={COST_LABELS}
                            bilingualKey={COST_BILINGUAL_KEY[item.id]}
                            pdfLang={pdfLang}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.editable ? (
                        <>
                          <input
                            id={`cost-amount-${item.id}`}
                            type="number"
                            min={0}
                            value={item.amount}
                            onChange={(e) => updateCost(item.id, e.target.value)}
                            className="print:hidden w-32 text-right rounded-lg border border-slate-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-900"
                          />
                          <span className="hidden print:inline">
                            <AmountDisplay amount={item.amount} pdfLang={pdfLang} />
                          </span>
                        </>
                      ) : (
                        <AmountDisplay amount={item.amount} pdfLang={pdfLang} />
                      )}
                    </td>
                    <td className="hidden sm:table-cell print:table-cell px-4 py-3 text-slate-400 text-xs">
                      {isUserAdded(item.id) ? (
                        <>
                          <input
                            type="text"
                            value={item.note}
                            onChange={(e) => updateCostField(item.id, "note", e.target.value)}
                            placeholder="備考"
                            className="print:hidden w-full border-b border-slate-200 focus:outline-none focus:border-[#2d5e3a] py-0.5 text-xs placeholder:text-[#a8c4ae]"
                          />
                          <span className="hidden print:inline">{item.note}</span>
                        </>
                      ) : (
                        item.note
                      )}
                    </td>
                    <td className="px-2 py-3 text-center print:hidden">
                      <button
                        onClick={() => deleteCost(item.id)}
                        className="w-6 h-6 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors text-base leading-none"
                        aria-label="削除"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td className="px-6 py-4 font-bold text-slate-900">
                <span className="print:hidden">初期費用合計</span>
                <span className="hidden print:inline">{bilingual("初期費用合計", "totalInit", pdfLang)}</span>
              </td>
              <td className="px-4 py-4 text-right">
                <span className="font-bold text-xl text-blue-700 font-mono">
                  <AmountDisplay amount={initialTotal} pdfLang={pdfLang} />
                </span>
              </td>
              <td className="hidden sm:table-cell print:table-cell px-4 py-4 text-slate-400 text-xs">
                <span className="print:hidden">消費税込</span>
                <span className="hidden print:inline">{SECTION.taxIncluded[pdfLang]}</span>
              </td>
              <td className="px-2 py-4 print:hidden" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="no-print px-6 pt-2 pb-4">
        <button
          onClick={addCost}
          className="border-dashed border border-[#b8d898] text-[#2d5e3a] text-[13px] rounded-lg py-2 w-full hover:bg-[#f7faf4] transition-colors"
        >
          ＋ 項目を追加
        </button>
      </div>

      {/* ===== 月額費用 ===== */}
      <div className="border-t border-[#dce8d4] my-3.5" />
      <div className="px-6 pb-2">
        <h3 className="text-[12px] font-medium text-[#2d5e3a] mb-3">
          <span className="print:hidden">月額費用</span>
          <span className="hidden print:inline">{sectionLabel("monthlyCosts", pdfLang)}</span>
        </h3>
      </div>
      <div className="overflow-x-auto pb-4">
        <table className="w-full text-sm">
          <tbody>
            {monthlyCosts
              .filter((c) => c.id !== "monthly_total")
              .map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 w-2/5">
                    {isUserAdded(item.id) ? (
                      <>
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => updateMonthlyField(item.id, e.target.value)}
                          placeholder="項目名"
                          className="print:hidden text-sm w-full border-b border-slate-200 focus:outline-none focus:border-[#2d5e3a] py-0.5 placeholder:text-[#a8c4ae]"
                        />
                        <span className="hidden print:inline font-medium">{item.label || "（項目名未入力）"}</span>
                      </>
                    ) : (
                      <ItemLabel
                        id={item.id}
                        fallback={item.label}
                        labelMap={MONTHLY_LABELS}
                        bilingualKey={MONTHLY_BILINGUAL_KEY[item.id]}
                        pdfLang={pdfLang}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right w-1/4">
                    {item.editable ? (
                      <>
                        <input
                          id={`monthly-amount-${item.id}`}
                          type="number"
                          min={0}
                          value={item.amount}
                          onChange={(e) => updateMonthly(item.id, e.target.value)}
                          className="print:hidden w-32 text-right rounded-lg border border-slate-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-900"
                        />
                        <span className="hidden print:inline">
                          <AmountDisplay amount={item.amount} pdfLang={pdfLang} />
                        </span>
                      </>
                    ) : (
                      <AmountDisplay amount={item.amount} pdfLang={pdfLang} />
                    )}
                  </td>
                  <td className="hidden sm:table-cell print:table-cell px-4 py-3" />
                  <td className="px-2 py-3 text-center print:hidden">
                    <button
                      onClick={() => deleteMonthly(item.id)}
                      className="w-6 h-6 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors text-base leading-none"
                      aria-label="削除"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            {monthlyCosts
              .filter((c) => c.id === "monthly_total")
              .map((item) => (
                <tr key={item.id} className="bg-[#eaf3de] border-t-2 border-[#b8d898]">
                  <td className="px-6 py-4 font-bold text-[#1a2e20]">
                    <ItemLabel
                      id={item.id}
                      fallback={item.label}
                      labelMap={MONTHLY_LABELS}
                      bilingualKey={MONTHLY_BILINGUAL_KEY[item.id]}
                      pdfLang={pdfLang}
                    />
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-xl text-[#2d5e3a] font-mono">
                    <AmountDisplay amount={item.amount} pdfLang={pdfLang} />
                    <span className="text-sm font-normal ml-1 print:hidden">/月</span>
                  </td>
                  <td className="hidden sm:table-cell print:table-cell px-4 py-4" />
                  <td className="px-2 py-4 print:hidden" />
                </tr>
              ))}
          </tfoot>
        </table>
      </div>
      <div className="no-print px-6 pt-2 pb-4">
        <button
          onClick={addMonthly}
          className="border-dashed border border-[#b8d898] text-[#2d5e3a] text-[13px] rounded-lg py-2 w-full hover:bg-[#f7faf4] transition-colors"
        >
          ＋ 項目を追加
        </button>
      </div>

      {/* ===== 物件写真（印刷時のみ・添付がある場合のみ） ===== */}
      {photoUrls.length > 0 && (
        <div className="hidden print:block px-6 py-6 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            物件写真
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {photoUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`物件写真 ${i + 1}`}
                className="w-full h-40 object-cover rounded border border-slate-200"
                style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== 用語解説（印刷時のみ） ===== */}
      {glossaryItems.length > 0 && (
        <div className="hidden print:block px-6 py-6 border-t-2 border-slate-200 mt-2 print-break-before">
          <h3 className="text-sm font-bold text-slate-800 mb-4">
            {SECTION.glossaryTitle[pdfLang] ?? "用語解説"}
          </h3>
          <div className="space-y-3">
            {glossaryItems.map((g) => (
              <div key={g.term} className="border-l-2 border-blue-300 pl-3">
                <p className="text-sm font-bold text-slate-800">
                  {g.term}
                  <span className="text-slate-500 font-normal text-xs ml-1.5">
                    （{g.furigana} / {g.romaji}）
                  </span>
                </p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{g.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== お客様向け免責文言（印刷時のみ・フッター直上） ===== */}
      <div className="hidden print:block px-6 pt-3 pb-4 mt-2 border-t border-slate-200 text-[8pt] text-slate-500 leading-snug">
        <p>※ 本見積書は概算です。実際の費用は変動する場合があります。詳細は担当者にご確認ください。</p>
        {pdfLang !== "ja" && T[pdfLang]?.customerDisclaimer && (
          <p className="mt-1">{T[pdfLang].customerDisclaimer}</p>
        )}
      </div>
    </div>
  );
}
