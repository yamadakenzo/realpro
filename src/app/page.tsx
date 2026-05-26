"use client";

import { useEffect, useRef, useState } from "react";
import ImageUploader from "@/components/ImageUploader";
import CostTable from "@/components/CostTable";
import AgentInfoForm from "@/components/AgentInfoForm";
import CustomerInfoForm from "@/components/CustomerInfoForm";
import PdfExportButton from "@/components/PdfExportButton";
import PdfModal from "@/components/PdfModal";
import HistoryTab from "@/components/HistoryTab";
import CompareTab from "@/components/CompareTab";
import LogoutButton from "@/components/LogoutButton";
import {
  LANGS, T, bilingual,
  COST_BILINGUAL_KEY, MONTHLY_BILINGUAL_KEY,
} from "@/lib/translations";
import { supabase } from "@/lib/supabase";
import type {
  AgentInfo, AnalyzeResponse, CostItem, CustomerInfo,
  Language, MonthlyItem, SavedEstimate,
} from "@/types";

type PdfMode = "preview" | "line-pdf" | "line-text";

// 「最低限あって欲しい」初期費用項目（解析後に0円 or 未追加なら警告表示）
const MISSING_CHECK_ITEMS: { id: string; label: string; category: string; note: string }[] = [
  { id: "deposit",        label: "敷金",           category: "家賃関連", note: "退去時に精算" },
  { id: "key_money",      label: "礼金",           category: "家賃関連", note: "返還なし" },
  { id: "agency_fee",     label: "仲介手数料",     category: "仲介費用", note: "家賃1ヶ月分＋消費税10%" },
  { id: "guarantee_fee",  label: "保証会社利用料", category: "保証・保険", note: "家賃0.5ヶ月分（目安）" },
  { id: "fire_insurance", label: "火災保険料",     category: "保証・保険", note: "2年契約の目安" },
  { id: "key_exchange",   label: "鍵交換費用",     category: "入居費用", note: "税込" },
];

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

  // 担当者コメント AI生成
  const [aiCommentLang, setAiCommentLang] = useState<Language>("en");
  const [aiCommentLoading, setAiCommentLoading] = useState(false);
  const [aiCommentError, setAiCommentError] = useState<string | null>(null);

  // 物件写真
  const [propertyPhotos, setPropertyPhotos] = useState<File[]>([]);
  const [propertyPhotoUrls, setPropertyPhotoUrls] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // 見積もり保存
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState(false);

  // PDF
  const [modalOpen, setModalOpen] = useState(false);
  const [pdfLang, setPdfLang] = useState<Language>("ja");
  const [showGlossary, setShowGlossary] = useState(false);
  const [printFlag, setPrintFlag] = useState(0);
  const [hasPrinted, setHasPrinted] = useState(false);

  // 言語選択モーダル / LINE共有方法選択モーダル
  const [selectedLang, setSelectedLang] = useState<Language>("en");
  const [showLangModal, setShowLangModal] = useState(false);
  const [showLineChoiceModal, setShowLineChoiceModal] = useState(false);
  const [pdfMode, setPdfMode] = useState<PdfMode>("preview");

  // LINEテキスト共有プレビュー
  const [showTextModal, setShowTextModal] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [copied, setCopied] = useState(false);

  // URL共有
  const [shareUrlLoading, setShareUrlLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const [shareUrlError, setShareUrlError] = useState<string | null>(null);

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
    document.title = agentInfo.companyName || "物件費用見積書";
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

  const handleGenerateComment = async () => {
    if (!result) return;
    setAiCommentLoading(true);
    setAiCommentError(null);
    try {
      const res = await fetch("/api/generate-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extracted: result.extracted,
          costs: result.costs,
          monthlyCosts: result.monthlyCosts,
          language: aiCommentLang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "コメント生成に失敗しました");
      setComment(data.comment ?? "");
    } catch (err) {
      setAiCommentError(err instanceof Error ? err.message : "不明なエラーが発生しました");
    } finally {
      setAiCommentLoading(false);
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
    propertyPhotoUrls.forEach((u) => URL.revokeObjectURL(u));
    setPropertyPhotos([]);
    setPropertyPhotoUrls([]);
    setUploaderKey((k) => k + 1);
    setShareUrl("");
    setShareUrlError(null);
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const newFiles = Array.from(files);
    const newUrls = newFiles.map((f) => URL.createObjectURL(f));
    setPropertyPhotos((prev) => [...prev, ...newFiles]);
    setPropertyPhotoUrls((prev) => [...prev, ...newUrls]);
    e.target.value = "";
  };

  const handlePhotoRemove = (i: number) => {
    URL.revokeObjectURL(propertyPhotoUrls[i]);
    setPropertyPhotos((prev) => prev.filter((_, idx) => idx !== i));
    setPropertyPhotoUrls((prev) => prev.filter((_, idx) => idx !== i));
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

  // LINE共有方法選択モーダル → 言語選択モーダル
  const openLineChoice = () => setShowLineChoiceModal(true);

  const handleLineChoice = (mode: "line-pdf" | "line-text") => {
    setShowLineChoiceModal(false);
    setPdfMode(mode);
    setShowLangModal(true);
  };

  // 「PDF 出力」ボタン → 言語選択モーダル（pdfMode = preview）
  const openPreviewLang = () => {
    setPdfMode("preview");
    setShowLangModal(true);
  };

  // 不足項目: 0円 or 未存在 のものを抽出
  const missingItems = result
    ? MISSING_CHECK_ITEMS.filter((m) => {
        const item = result.costs.find((c) => c.id === m.id);
        return !item || item.amount === 0;
      })
    : [];

  // 不足項目「追加する」: 行が無ければ復元、ある場合は金額入力にフォーカス
  const focusOrAddItem = (info: typeof MISSING_CHECK_ITEMS[number]) => {
    if (!result) return;
    const exists = result.costs.find((c) => c.id === info.id);
    if (!exists) {
      const newCost: CostItem = {
        id: info.id,
        category: info.category,
        label: info.label,
        amount: 0,
        note: info.note,
        editable: true,
      };
      handleCostsChange([...result.costs, newCost]);
    }
    setTimeout(() => {
      const el = document.getElementById(`cost-amount-${info.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus();
    }, 100);
  };

  // 言語選択モーダル「次へ」
  const handleLangNext = () => {
    setShowLangModal(false);
    setPdfLang(selectedLang);
    if (pdfMode === "line-text") {
      setPreviewText(generateLineText(selectedLang));
      setShowTextModal(true);
    } else {
      // preview / line-pdf → どちらも PdfModal を開く（モード差は印刷時のボタンで切り替え）
      setModalOpen(true);
    }
  };

  const handleLogoChange = (dataUrl: string) => {
    setLogoDataUrl(dataUrl);
    try {
      if (dataUrl) localStorage.setItem(LOGO_KEY, dataUrl);
      else localStorage.removeItem(LOGO_KEY);
    } catch {}
  };

  const handleSave = () => {
    if (!result) return;
    const fallbackName = result.extracted.propertyName?.trim()
      || `見積もり ${new Date().toLocaleDateString("ja-JP")}`;
    const name = saveName.trim() || fallbackName;
    const entry: SavedEstimate = {
      id: Date.now().toString(),
      name,
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

  const handleAddToCompare = () => {
    if (!result) return;
    handleSave();
    setActiveTab("compare");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    propertyPhotoUrls.forEach((u) => URL.revokeObjectURL(u));
    setPropertyPhotos([]);
    setPropertyPhotoUrls([]);
    setUploaderKey((k) => k + 1);
    setShareUrl("");
    setShareUrlError(null);
    setActiveTab("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // bilingual で「日本語（翻訳）」併記したLINE共有テキストを生成
  const generateLineText = (lang: Language): string => {
    if (!result) return "";
    const prop = result.extracted;
    const monthly = result.monthlyCosts.find((c) => c.id === "monthly_total");

    const fmt = (n: number) => `¥${n.toLocaleString("ja-JP")}`;
    const bi = (ja: string, key: string) => bilingual(ja, key, lang);

    const blocks: (string | false | undefined)[] = [
      `【${bi("物件費用見積書", "docTitle")}】`,
      customerInfo.customerName && `お客様: ${customerInfo.customerName}様`,
      "",
      `▼ ${bi("物件情報", "propertyInfo")}`,
      prop.propertyName && `物件名: ${prop.propertyName}`,
      prop.roomNumber && `部屋番号: ${prop.roomNumber}`,
      prop.address && `住所: ${prop.address}`,
      prop.floorPlan && `間取り: ${prop.floorPlan}`,
      prop.area > 0 && `面積: ${prop.area}m²`,
      "",
      `▼ ${bi("初期費用", "initial")}`,
      ...result.costs
        .filter((c) => c.amount > 0)
        .map((c) => `  ${bi(c.label, COST_BILINGUAL_KEY[c.id] ?? "")}: ${fmt(c.amount)}`),
      `${bi("初期費用合計", "totalInit")}: ${fmt(result.totalCost)}`,
      "",
      `▼ ${bi("月額費用", "monthly")}`,
      ...result.monthlyCosts
        .filter((c) => c.id !== "monthly_total")
        .map((c) => `  ${bi(c.label, MONTHLY_BILINGUAL_KEY[c.id] ?? "")}: ${fmt(c.amount)}`),
      monthly && `${bi("月額合計", "monthlyTotal")}: ${fmt(monthly.amount)}`,
      "",
      comment && `▼ ${bi("担当者コメント", "agentComment")}\n${comment}`,
      comment ? "" : undefined,
      "※ 本見積書は概算です。実際の費用は変動する場合があります。詳細は担当者にご確認ください。",
      lang !== "ja" && T[lang]?.customerDisclaimer,
      "",
      validUntil && `${bi("見積もり有効期限", "validUntil")}: ${new Date(validUntil).toLocaleDateString("ja-JP")}`,
      (agentInfo.companyName || agentInfo.agentName) &&
        `担当: ${[agentInfo.companyName, agentInfo.agentName].filter(Boolean).join(" / ")}`,
      agentInfo.phone && `TEL: ${agentInfo.phone}`,
    ];

    return blocks.filter((v) => v !== false && v !== undefined).join("\n");
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 一部ブラウザでは clipboard 権限が無い
    }
  };

  const uploadPropertyPhotos = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    const folder =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = (file.name.split(".").pop() || "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 5) || "jpg";
      const path = `${folder}/${i}.${ext}`;
      const { error } = await supabase.storage
        .from("estimate-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        throw new Error(`画像のアップロードに失敗しました (${file.name}): ${error.message}`);
      }
      const { data } = supabase.storage.from("estimate-photos").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleShareUrl = async () => {
    if (!result || shareUrlLoading) return;
    setShareUrlLoading(true);
    setShareUrlError(null);
    setShareUrlCopied(false);
    try {
      const uploadedPhotoUrls = await uploadPropertyPhotos(propertyPhotos);
      const payload = {
        result,
        agentInfo,
        customerInfo: customerInfo.customerName ? customerInfo : undefined,
        comment: comment.trim() || undefined,
        validUntil,
        propertyPhotoUrls: uploadedPhotoUrls,
      };
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "URLの生成に失敗しました");
      }
      setShareUrl(data.url);
      try {
        await navigator.clipboard.writeText(data.url);
        setShareUrlCopied(true);
        setTimeout(() => setShareUrlCopied(false), 2000);
      } catch {
        // クリップボード権限なし → 画面表示のみ
      }
    } catch (err) {
      setShareUrlError(err instanceof Error ? err.message : "不明なエラーが発生しました");
    } finally {
      setShareUrlLoading(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareUrlCopied(true);
      setTimeout(() => setShareUrlCopied(false), 2000);
    } catch {
      // 無視
    }
  };

  const handleOpenInLine = () => {
    window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(previewText)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleSendLinePdf = async (lang: Language, glossary: boolean) => {
    if (!result) return;
    setPdfLang(lang);
    setShowGlossary(glossary);
    setModalOpen(false);
    const text = generateLineText(lang);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "物件費用見積書", text });
        return;
      } catch {
        // ユーザーキャンセル or 失敗 → 印刷ダイアログにフォールバック
      }
    }
    setHasPrinted(true);
    setPrintFlag((f) => f + 1);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "new", label: "新規見積もり" },
    { id: "history", label: "保存済み履歴" },
    { id: "compare", label: "比較表" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ===== 印刷フッター（全ページに固定表示） ===== */}
      {(agentInfo.companyName || agentInfo.agentName || agentInfo.phone) && (
        <div className="print-page-footer hidden print:flex">
          {agentInfo.companyName && <span>{agentInfo.companyName}</span>}
          {agentInfo.agentName && <span>担当: {agentInfo.agentName}</span>}
          {agentInfo.phone && <span>TEL: {agentInfo.phone}</span>}
        </div>
      )}

      {/* ヘッダー */}
      <header className="no-print bg-[#f7f9f4] border-b border-[#dce8d4]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-[#2d5e3a] rounded-[9px] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-medium text-[#1a2e20] tracking-tight">物件費用見積書</h1>
            <p className="text-[11px] text-[#7a9e82] mt-0.5">AI自動読み取り・多言語対応</p>
          </div>
          <span className="bg-[#eaf3de] text-[#27500a] text-[10px] rounded-full border border-[#b8d898] px-2 py-0.5 font-medium shrink-0">
            Beta
          </span>
          <LogoutButton />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                "px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5",
                activeTab === id
                  ? "border-[#2d5e3a] text-[#1a2e20]"
                  : "border-transparent text-[#90b098] hover:text-[#1a2e20]",
              ].join(" ")}
            >
              {label}
              {id === "history" && estimates.length > 0 && (
                <span className={[
                  "text-xs px-1.5 py-0.5 rounded-full font-medium",
                  activeTab === "history" ? "bg-[#2d5e3a] text-white" : "bg-[#eaf3de] text-[#5a7a62]",
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

            {/* Step 2 — 物件写真 */}
            <div className="no-print">
              <div className="bg-white border border-[#dce8d4] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-semibold text-[#1a2e20]">Step 2 — 物件写真</h2>
                  <span className="bg-[#eaf3de] text-[#27500a] text-[10px] rounded-full border border-[#b8d898] px-2 py-0.5 font-medium">
                    新機能
                  </span>
                </div>
                <p className="text-xs text-[#7a9e82] mb-4">PDFに掲載（未添付時はPDFに表示されません）</p>
                <div className="flex flex-wrap gap-3">
                  {propertyPhotoUrls.map((url, i) => (
                    <div key={url} className="relative w-20 h-14 rounded-lg overflow-hidden border border-[#dce8d4]">
                      <img src={url} alt={`物件写真 ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => handlePhotoRemove(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center shadow hover:bg-red-600 transition-colors"
                        aria-label="削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="w-20 h-14 rounded-lg border-2 border-dashed border-[#b8d898] bg-[#f7faf4] flex items-center justify-center text-[#7a9e82] text-2xl leading-none hover:bg-[#eaf3de] transition-colors"
                    aria-label="写真追加"
                  >
                    +
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoAdd}
                    className="hidden"
                  />
                </div>
              </div>
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

            {/* ===== アクションバー ===== */}
            <div className="no-print">
              <div className="bg-white border border-[#dce8d4] rounded-xl px-6 py-4">
                <p className="text-[12px] text-[#7a9e82] mb-2.5">
                  解析完了後、お客様への共有・保存ができます
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {/* LINEで共有 */}
                  <button
                    onClick={openLineChoice}
                    disabled={!result}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-opacity",
                      result ? "bg-[#06C755] text-white hover:opacity-90" : "bg-slate-100 text-slate-400 cursor-not-allowed",
                    ].join(" ")}
                  >
                    <span className={[
                      "w-5 h-5 rounded-[5px] flex items-center justify-center shrink-0",
                      result ? "bg-white" : "bg-slate-200",
                    ].join(" ")}>
                      <svg viewBox="0 0 40 40" fill="none" className="w-[13px] h-[13px]">
                        <path d="M20 4C11.163 4 4 10.478 4 18.444c0 5.152 3.09 9.677 7.752 12.374L10 36l5.8-2.895C17.148 33.35 18.554 33.6 20 33.6c8.837 0 16-6.478 16-14.156C36 10.478 28.837 4 20 4z" fill={result ? "#06C755" : "#cbd5e1"} />
                        <path d="M28 21.5c0 .28-.23.5-.5.5H12.5c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5h15c.27 0 .5.22.5.5v1zm-1-4c0 .28-.23.5-.5.5h-13c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5h13c.27 0 .5.22.5.5v1z" fill="white" />
                      </svg>
                    </span>
                    LINEで共有
                  </button>
                  {/* URLで共有 */}
                  <button
                    onClick={handleShareUrl}
                    disabled={!result || shareUrlLoading}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                      result && !shareUrlLoading
                        ? "bg-[#4a7f86] text-white hover:bg-[#3a6970]"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed",
                    ].join(" ")}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.828 10.172a4 4 0 015.656 0l1.414 1.414a4 4 0 010 5.656l-2.829 2.829a4 4 0 01-5.656 0l-1.414-1.414M10.172 13.828a4 4 0 01-5.656 0L3.1 12.414a4 4 0 010-5.656l2.829-2.829a4 4 0 015.656 0l1.414 1.414" />
                    </svg>
                    {shareUrlLoading ? "生成中..." : "URLで共有"}
                  </button>
                  {/* PDFを開く */}
                  <button
                    onClick={openPreviewLang}
                    disabled={!result}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                      result ? "bg-[#1a2e20] text-white hover:bg-[#0f1a13]" : "bg-slate-100 text-slate-400 cursor-not-allowed",
                    ].join(" ")}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
                    </svg>
                    PDFを開く
                  </button>
                  {/* 見積もりを保存 */}
                  <button
                    onClick={handleSave}
                    disabled={!result}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                      result
                        ? saved
                          ? "bg-emerald-500 text-white"
                          : "bg-[#2d5e3a] text-white hover:bg-[#1a2e20]"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed",
                    ].join(" ")}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M5 5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5zm3 0v4h6V5H8zm-1 9h10" />
                    </svg>
                    {saved ? "✓ 保存済み" : "見積もりを保存"}
                  </button>
                  {/* 比較表に追加 */}
                  <button
                    onClick={handleAddToCompare}
                    disabled={!result}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors",
                      result
                        ? "bg-white border-[#dce8d4] text-[#2d5e3a] hover:bg-[#f7faf4] hover:border-[#b8d898]"
                        : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed",
                    ].join(" ")}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 10h18M3 14h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
                    </svg>
                    比較表に追加
                  </button>
                </div>

                {(shareUrl || shareUrlError) && (
                  <div className="mt-3">
                    {shareUrlError && (
                      <p className="text-xs text-red-600">{shareUrlError}</p>
                    )}
                    {shareUrl && (
                      <div className="flex items-center gap-2 p-2.5 bg-[#f7faf4] border border-[#dce8d4] rounded-lg">
                        <input
                          type="text"
                          value={shareUrl}
                          readOnly
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-0 bg-transparent text-xs text-[#1a2e20] focus:outline-none truncate"
                        />
                        <button
                          onClick={handleCopyShareUrl}
                          className={[
                            "shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
                            shareUrlCopied
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "bg-white border-[#dce8d4] text-[#2d5e3a] hover:bg-[#eaf3de]",
                          ].join(" ")}
                        >
                          {shareUrlCopied ? "✓ コピー済み" : "コピー"}
                        </button>
                        <a
                          href={shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium border border-[#dce8d4] bg-white text-[#2d5e3a] hover:bg-[#eaf3de] transition-colors"
                        >
                          開く
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: 解析結果 */}
            {result && (
              <section className="space-y-4">
                {/* Step 3 ヘッダー + 有効期限 + 全リセット */}
                <div className="no-print flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-700">Step 3 — 初期費用一覧</h2>
                    <p className="text-xs text-slate-400 mt-0.5">金額は直接編集できます</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-medium text-slate-500">有効期限</label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-slate-700 bg-white"
                    />
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      全リセット
                    </button>
                  </div>
                </div>

                {/* 仲介業者向け注意書き（画面のみ） */}
                <div className="no-print bg-amber-50 border border-amber-200 rounded-lg p-3 text-[12px] text-amber-800">
                  ⚠️ AIによる自動読み取り結果です。お客様への共有前に、必ず内容をご確認のうえ、管理会社にもご確認ください。
                </div>

                {/* 不足項目アラート */}
                {missingItems.length > 0 && (
                  <div className="no-print bg-blue-50 border border-blue-200 rounded-lg p-3 text-[12px] text-blue-800">
                    以下の項目が0円または未入力です。内容をご確認ください：
                    {missingItems.map((m, i) => (
                      <span key={m.id}>
                        {i === 0 ? " " : "、"}
                        {m.label}
                        <button
                          onClick={() => focusOrAddItem(m)}
                          className="ml-1 underline hover:no-underline text-blue-700 font-medium"
                        >
                          追加する
                        </button>
                      </span>
                    ))}
                  </div>
                )}

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
                  photoUrls={propertyPhotoUrls}
                  onCostsChange={handleCostsChange}
                  onMonthlyCostsChange={handleMonthlyCostsChange}
                  onRoomNumberChange={handleRoomNumberChange}
                />

                {/* 担当者コメント */}
                <div className={[
                  "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden",
                  comment ? "" : "print:hidden",
                ].join(" ")}>
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-slate-700">担当者コメント</h3>
                    <span className="text-xs text-slate-400 ml-1 no-print">— お客様へのメッセージ</span>
                  </div>
                  <div className="p-6">
                    <div className="no-print mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#f7faf4] border border-[#dce8d4] px-3 py-2.5">
                      <span className="text-xs font-medium text-[#1a2e20] shrink-0">AIで下書きを生成</span>
                      <select
                        value={aiCommentLang}
                        onChange={(e) => setAiCommentLang(e.target.value as Language)}
                        disabled={aiCommentLoading}
                        className="text-xs rounded-md border border-[#cfddc3] bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#b8d898] disabled:opacity-50"
                      >
                        {LANGS.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.flag} {l.label}（{l.sub}）
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleGenerateComment}
                        disabled={aiCommentLoading}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[#2d5e3a] hover:bg-[#244c2f] text-white text-xs font-medium px-3 py-1.5 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                      >
                        {aiCommentLoading ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                            </svg>
                            生成中…
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            AIで自動生成
                          </>
                        )}
                      </button>
                    </div>
                    {aiCommentError && (
                      <p className="no-print mb-2 text-xs text-red-600">{aiCommentError}</p>
                    )}
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="例）この物件は駅近で生活環境も充実しています。ご不明な点はお気軽にご相談ください。"
                      rows={6}
                      className="no-print w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder:text-[#a8c4ae] leading-relaxed"
                    />
                    <p className="no-print mt-1.5 text-xs text-slate-400">
                      生成結果はそのまま編集できます。
                    </p>
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
        initialLang={selectedLang}
        pdfMode={pdfMode}
        onClose={() => setModalOpen(false)}
        onConfirm={handlePdfConfirm}
        onLineShare={handleSendLinePdf}
      />

      {/* ===== LINE共有方法選択モーダル ===== */}
      {showLineChoiceModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowLineChoiceModal(false)}
        >
          <div className="bg-white rounded-[14px] border border-[#dce8d4] p-[22px] w-[340px]">
            <h2 className="text-base font-semibold text-[#1a2e20] mb-1">LINEで共有方法を選択</h2>
            <p className="text-xs text-[#7a9e82] mb-4">送りたい形式を選んでください</p>
            <div className="space-y-2 mb-4">
              <button
                onClick={() => handleLineChoice("line-pdf")}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-[#dce8d4] hover:border-[#b8d898] hover:bg-[#f7faf4] transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-lg bg-[#eaf3de] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-[#2d5e3a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-medium text-[#1a2e20]">PDFをLINEで送る</span>
                  <span className="block text-[11px] text-[#7a9e82]">PDFを保存してLINEで共有</span>
                </span>
              </button>
              <button
                onClick={() => handleLineChoice("line-text")}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-[#dce8d4] hover:border-[#b8d898] hover:bg-[#f7faf4] transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-lg bg-[#eaf3de] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-[#2d5e3a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h8m-8 4h6m-9 5l3.586-3.586A2 2 0 0110 17H17a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v14z" />
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-medium text-[#1a2e20]">テキストをLINEで送る</span>
                  <span className="block text-[11px] text-[#7a9e82]">見積もり内容をテキストで共有</span>
                </span>
              </button>
            </div>
            <button
              onClick={() => setShowLineChoiceModal(false)}
              className="w-full py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ===== 言語選択モーダル ===== */}
      {showLangModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowLangModal(false)}
        >
          <div className="bg-white rounded-[14px] border border-[#dce8d4] p-[22px] w-[340px]">
            <h2 className="text-base font-semibold text-[#1a2e20] mb-1">言語を選択</h2>
            <p className="text-xs text-[#7a9e82] mb-4">
              {pdfMode === "line-text"
                ? "テキスト共有時の言語を選んでください"
                : "PDFに表示する言語を選んでください"}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {LANGS.map((l) => {
                const selected = selectedLang === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => setSelectedLang(l.code)}
                    className={[
                      "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors",
                      selected
                        ? "border-[#2d5e3a] bg-[#eaf3de]"
                        : "border-[#dce8d4] hover:border-[#b8d898] hover:bg-[#f7faf4]",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{l.flag}</span>
                      <span className={[
                        "text-[13px] font-medium leading-tight",
                        selected ? "text-[#1a2e20]" : "text-slate-700",
                      ].join(" ")}>
                        {l.label}
                      </span>
                    </span>
                    <span className={[
                      "text-[10px] leading-none",
                      selected ? "text-[#5a7a62]" : "text-[#7a9e82]",
                    ].join(" ")}>
                      {l.sub}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLangModal(false)}
                className="flex-1 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleLangNext}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#2d5e3a] text-white hover:bg-[#1a2e20] transition-colors"
              >
                次へ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== LINEテキスト共有プレビューモーダル ===== */}
      {showTextModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowTextModal(false)}
        >
          <div className="bg-white rounded-[14px] w-[400px] max-w-full overflow-hidden flex flex-col max-h-[85vh]">
            {/* ヘッダー */}
            <div className="bg-[#06C755] px-5 py-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-white rounded-[5px] flex items-center justify-center shrink-0">
                <svg viewBox="0 0 40 40" fill="none" className="w-4 h-4">
                  <path d="M20 4C11.163 4 4 10.478 4 18.444c0 5.152 3.09 9.677 7.752 12.374L10 36l5.8-2.895C17.148 33.35 18.554 33.6 20 33.6c8.837 0 16-6.478 16-14.156C36 10.478 28.837 4 20 4z" fill="#06C755" />
                  <path d="M28 21.5c0 .28-.23.5-.5.5H12.5c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5h15c.27 0 .5.22.5.5v1zm-1-4c0 .28-.23.5-.5.5h-13c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5h13c.27 0 .5.22.5.5v1z" fill="white" />
                </svg>
              </span>
              <h2 className="text-white font-semibold text-sm">LINEテキスト共有</h2>
              <button
                onClick={() => setShowTextModal(false)}
                className="ml-auto text-white/80 hover:text-white text-xl leading-none"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            {/* 本文 */}
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <p className="text-[11px] text-[#7a9e82] mb-2">
                以下のテキストがLINEで共有されます。コピーしてLINEに貼り付けるか、「LINEで開く」を押してください。
              </p>
              <textarea
                value={previewText}
                readOnly
                className="w-full h-72 text-[11px] font-mono border border-slate-200 rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2d5e3a] bg-slate-50"
              />
            </div>
            {/* フッター */}
            <div className="px-5 pb-5 pt-2 flex gap-2 border-t border-slate-100">
              <button
                onClick={handleCopyText}
                className={[
                  "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-1.5",
                  copied
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white border-[#dce8d4] text-[#2d5e3a] hover:bg-[#f7faf4]",
                ].join(" ")}
              >
                {copied ? (
                  <>✓ コピー済み</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    コピー
                  </>
                )}
              </button>
              <button
                onClick={handleOpenInLine}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#06C755] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                LINEで開く
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
