"use client";

import { useEffect, useState } from "react";
import ImageUploader from "@/components/ImageUploader";
import CostTable from "@/components/CostTable";
import AgentInfoForm from "@/components/AgentInfoForm";
import CustomerInfoForm from "@/components/CustomerInfoForm";
import PdfExportButton from "@/components/PdfExportButton";
import PdfModal from "@/components/PdfModal";
import HistoryTab from "@/components/HistoryTab";
import CompareTab from "@/components/CompareTab";
import type {
  AgentInfo, AnalyzeResponse, CostItem, CustomerInfo,
  Language, MonthlyItem, SavedEstimate,
} from "@/types";

const STORAGE_KEY = "realpro_estimates";
const LOGO_KEY = "realpro_logo";

const DEFAULT_AGENT: AgentInfo = { agentName: "", companyName: "", phone: "" };
const DEFAULT_CUSTOMER: CustomerInfo = { customerName: "" };

function getDefaultValidUntil() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split("T")[0];
}

function loadEstimates(): SavedEstimate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedEstimate[]) : [];
  } catch {
    return [];
  }
}

function persistEstimates(list: SavedEstimate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

type Tab = "new" | "history" | "compare";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("new");
  const [uploaderKey, setUploaderKey] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<AgentInfo>(DEFAULT_AGENT);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(DEFAULT_CUSTOMER);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [estimates, setEstimates] = useState<SavedEstimate[]>([]);
  const [validUntil, setValidUntil] = useState(getDefaultValidUntil);
  const [comment, setComment] = useState("");

  // 見積もり保存
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState(false);

  // PDF
  const [modalOpen, setModalOpen] = useState(false);
  const [pdfLang, setPdfLang] = useState<Language>("ja");
  const [showGlossary, setShowGlossary] = useState(false);
  const [printFlag, setPrintFlag] = useState(0);
  const [hasPrinted, setHasPrinted] = useState(false);

  // 初期ロード
  useEffect(() => {
    setEstimates(loadEstimates());
    try {
      const logo = localStorage.getItem(LOGO_KEY);
      if (logo) setLogoDataUrl(logo);
    } catch {}
  }, []);

  // 物件名をデフォルト保存名に
  useEffect(() => {
    if (result?.extracted.propertyName) setSaveName(result.extracted.propertyName);
  }, [result?.extracted.propertyName]);

  // 印刷: document.title を会社名に変更
  useEffect(() => {
    if (printFlag === 0) return;
    const original = document.title;
    document.title = agentInfo.companyName || "不動産初期費用計算書";
    window.addEventListener("afterprint", () => { document.title = original; }, { once: true });
    window.print();
  }, [printFlag]);

  const handleAnalyze = async (files: File[]) => {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setHasPrinted(false);
    try {
      const body = new FormData();
      files.forEach((f) => body.append("image", f));
      const res = await fetch("/api/analyze", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "解析に失敗しました");
      setResult(data as AnalyzeResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "不明なエラーが発生しました");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setSaveName("");
    setSaved(false);
    setHasPrinted(false);
    setValidUntil(getDefaultValidUntil());
    setComment("");
    setCustomerInfo(DEFAULT_CUSTOMER);
    setUploaderKey((k) => k + 1);
  };

  const handleCostsChange = (costs: CostItem[]) => {
    if (!result) return;
    setResult({ ...result, costs, totalCost: costs.reduce((s, c) => s + c.amount, 0) });
  };

  // 家賃・管理費変更時は依存する初期費用も再計算
  const handleMonthlyCostsChange = (monthlyCosts: MonthlyItem[]) => {
    if (!result) return;
    const newRent = monthlyCosts.find((c) => c.id === "monthly_rent")?.amount ?? result.extracted.rent;
    const newMgmt = monthlyCosts.find((c) => c.id === "monthly_mgmt")?.amount ?? result.extracted.managementFee;
    const newBase = newRent + newMgmt;
    const oldBase = result.extracted.rent + result.extracted.managementFee;

    let { costs, extracted } = result;
    if (newBase !== oldBase) {
      extracted = { ...extracted, rent: newRent, managementFee: newMgmt };
      costs = costs.map((c) => {
        if (c.id === "rent_first")    return { ...c, amount: newBase };
        if (c.id === "agency_fee")    return { ...c, amount: Math.round(newBase * 1.1) };
        if (c.id === "guarantee_fee") return { ...c, amount: Math.round(newBase * 0.5) };
        return c;
      });
    }

    setResult({
      ...result,
      extracted,
      costs,
      totalCost: costs.reduce((s, c) => s + c.amount, 0),
      monthlyCosts,
    });
  };

  const handleRoomNumberChange = (roomNumber: string) => {
    if (!result) return;
    setResult({ ...result, extracted: { ...result.extracted, roomNumber } });
  };

  const handlePdfConfirm = (lang: Language, glossary: boolean) => {
    setModalOpen(false);
    setPdfLang(lang);
    setShowGlossary(glossary);
    setHasPrinted(true);
    setPrintFlag((f) => f + 1);
  };

  const handlePdfDownload = () => {
    if (!result) return;
    setHasPrinted(true);
    setPrintFlag((f) => f + 1);
  };

  const handleLogoChange = (dataUrl: string) => {
    setLogoDataUrl(dataUrl);
    try {
      if (dataUrl) localStorage.setItem(LOGO_KEY, dataUrl);
      else localStorage.removeItem(LOGO_KEY);
    } catch {}
  };

  const handleSave = () => {
    if (!result || !saveName.trim()) return;
    const entry: SavedEstimate = {
      id: Date.now().toString(),
      name: saveName.trim(),
      savedAt: new Date().toISOString(),
      result,
      agentInfo,
      customerInfo: customerInfo.customerName ? customerInfo : undefined,
      comment: comment.trim() || undefined,
    };
    const updated = [entry, ...estimates];
    setEstimates(updated);
    persistEstimates(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = (id: string) => {
    const updated = estimates.filter((e) => e.id !== id);
    setEstimates(updated);
    persistEstimates(updated);
  };

  const handleRestore = (restoredResult: AnalyzeResponse, restoredAgent: AgentInfo, est: SavedEstimate) => {
    setResult(restoredResult);
    setAgentInfo(restoredAgent);
    setCustomerInfo(est.customerInfo ?? DEFAULT_CUSTOMER);
    setComment(est.comment ?? "");
    setError(null);
    setSaveName("");
    setSaved(false);
    setHasPrinted(false);
    setValidUntil(getDefaultValidUntil());
    setUploaderKey((k) => k + 1);
    setActiveTab("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLineShare = () => {
    if (!result) return;
    const prop = result.extracted;
    const monthly = result.monthlyCosts.find((c) => c.id === "monthly_total");
    const costLines = result.costs
      .filter((c) => c.amount > 0)
      .map((c) => `  ${c.label}: ¥${c.amount.toLocaleString("ja-JP")}`);

    const lines = [
      "【不動産初期費用計算書】",
      customerInfo.customerName && `お客様: ${customerInfo.customerName}様`,
      "",
      "▼ 物件情報",
      prop.propertyName && `物件名: ${prop.propertyName}`,
      prop.roomNumber && `部屋番号: ${prop.roomNumber}`,
      prop.address && `住所: ${prop.address}`,
      prop.floorPlan && `間取り: ${prop.floorPlan}`,
      prop.area > 0 && `面積: ${prop.area}m²`,
      "",
      "▼ 初期費用内訳",
      ...costLines,
      `初期費用合計: ¥${result.totalCost.toLocaleString("ja-JP")}`,
      "",
      "▼ 毎月の支払い",
      ...result.monthlyCosts
        .filter((c) => c.id !== "monthly_total")
        .map((c) => `  ${c.label}: ¥${c.amount.toLocaleString("ja-JP")}`),
      monthly && `月額合計: ¥${monthly.amount.toLocaleString("ja-JP")}`,
      "",
      validUntil && `有効期限: ${new Date(validUntil).toLocaleDateString("ja-JP")}`,
      (agentInfo.companyName || agentInfo.agentName) &&
        `担当: ${[agentInfo.companyName, agentInfo.agentName].filter(Boolean).join(" / ")}`,
      agentInfo.phone && `TEL: ${agentInfo.phone}`,
    ].filter((v) => v !== false && v !== undefined && v !== "").join("\n");

    window.open(
      `https://social-plugins.line.me/lineit/share?text=${encodeURIComponent(lines)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "new", label: "新規見積もり" },
    { id: "history", label: "保存済み履歴" },
    { id: "compare", label: "比較表" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ===== 印刷フッター（全ページに固定表示） ===== */}
      <div className="print-page-footer hidden print:flex">
        {agentInfo.companyName && <span>{agentInfo.companyName}</span>}
        {agentInfo.agentName && <span>担当: {agentInfo.agentName}</span>}
        {agentInfo.phone && <span>TEL: {agentInfo.phone}</span>}
      </div>

      {/* ヘッダー */}
      <header className="no-print bg-blue-700 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">不動産初期費用計算アプリ</h1>
          <p className="text-blue-200 text-xs sm:text-sm mt-0.5">
            RealNetPro のスクリーンショットから初期費用を自動算出
          </p>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex gap-1 border-t border-blue-600">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                "px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5",
                activeTab === id
                  ? "border-white text-white"
                  : "border-transparent text-blue-300 hover:text-white hover:border-blue-400",
              ].join(" ")}
            >
              {label}
              {id === "history" && estimates.length > 0 && (
                <span className={[
                  "text-xs px-1.5 py-0.5 rounded-full font-medium",
                  activeTab === "history" ? "bg-white text-blue-700" : "bg-blue-600 text-blue-200",
                ].join(" ")}>
                  {estimates.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ===== 新規見積もりタブ ===== */}
        {activeTab === "new" && (
          <div className="space-y-5">
            <div className="no-print">
              <ImageUploader key={uploaderKey} onAnalyze={handleAnalyze} loading={analyzing} />
              {error && (
                <div className="mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* 担当者情報 */}
            <div className="no-print">
              <AgentInfoForm
                info={agentInfo}
                onChange={setAgentInfo}
                logoDataUrl={logoDataUrl}
                onLogoChange={handleLogoChange}
              />
            </div>

            {/* お客様情報 */}
            <div className="no-print">
              <CustomerInfoForm info={customerInfo} onChange={setCustomerInfo} />
            </div>

            {/* Step 2: 解析結果 */}
            {result && (
              <section className="space-y-4">
                {/* アクションバー */}
                <div className="no-print space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-700">Step 2 — 初期費用一覧</h2>
                      <p className="text-xs text-slate-400 mt-0.5">金額は直接編集できます</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 保存 */}
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5">
                        <input
                          type="text"
                          value={saveName}
                          onChange={(e) => setSaveName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSave()}
                          placeholder="見積もり名"
                          className="w-28 sm:w-40 text-sm focus:outline-none placeholder:text-slate-300 bg-transparent"
                        />
                        <button
                          onClick={handleSave}
                          disabled={!saveName.trim()}
                          className={[
                            "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                            saveName.trim()
                              ? saved
                                ? "bg-emerald-500 text-white"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed",
                          ].join(" ")}
                        >
                          {saved ? "✓ 保存済み" : "保存"}
                        </button>
                      </div>
                      {/* LINE共有（2択） */}
                      {hasPrinted && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleLineShare}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-l-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors border-r border-green-600"
                            title="テキスト内容をLINEで送る"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                            </svg>
                            テキスト
                          </button>
                          <button
                            onClick={handlePdfDownload}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-r-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
                            title="PDFをダウンロードしてLINEで送る"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            PDF
                          </button>
                        </div>
                      )}
                      {/* PDFダウンロード */}
                      <button
                        onClick={handlePdfDownload}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-slate-700 text-white hover:bg-slate-800 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span className="hidden sm:inline">PDFを保存</span>
                      </button>
                      {/* リセット */}
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-600 border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="hidden sm:inline">全リセット</span>
                      </button>
                      <PdfExportButton onOpen={() => setModalOpen(true)} />
                    </div>
                  </div>

                  {/* 有効期限 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-medium text-slate-500">有効期限</label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-700 bg-white"
                    />
                    <span className="text-xs text-slate-400">（デフォルト: 2週間後）</span>
                  </div>
                </div>

                <CostTable
                  extracted={result.extracted}
                  costs={result.costs}
                  monthlyCosts={result.monthlyCosts}
                  agentInfo={agentInfo}
                  logoDataUrl={logoDataUrl}
                  validUntil={validUntil}
                  customerName={customerInfo.customerName}
                  pdfLang={pdfLang}
                  showGlossary={showGlossary}
                  onCostsChange={handleCostsChange}
                  onMonthlyCostsChange={handleMonthlyCostsChange}
                  onRoomNumberChange={handleRoomNumberChange}
                />

                {/* 担当者コメント */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-slate-700">担当者コメント</h3>
                    <span className="text-xs text-slate-400 ml-1">— 外国人に刺さるポイントや物件の魅力を記入</span>
                  </div>
                  <div className="p-6">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="例: 駅徒歩3分・オートロック完備・外国人歓迎。管理会社が多言語対応しており、入居後も安心です。..."
                      rows={4}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder:text-slate-300 leading-relaxed"
                    />
                    {comment && (
                      <p className="hidden print:block text-sm text-slate-700 leading-relaxed mt-2 whitespace-pre-wrap">
                        {comment}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ===== 保存済み履歴タブ ===== */}
        {activeTab === "history" && (
          <HistoryTab
            estimates={estimates}
            onRestore={(r, a, est) => handleRestore(r, a, est)}
            onDelete={handleDelete}
          />
        )}

        {/* ===== 比較表タブ ===== */}
        {activeTab === "compare" && (
          <CompareTab estimates={estimates} />
        )}
      </main>

      <PdfModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handlePdfConfirm}
      />
    </div>
  );
}
