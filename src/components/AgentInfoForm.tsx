"use client";

import { useRef } from "react";
import type { AgentInfo } from "@/types";

interface Props {
  info: AgentInfo;
  onChange: (info: AgentInfo) => void;
  logoDataUrl: string;
  onLogoChange: (dataUrl: string) => void;
}

const FIELDS: { key: keyof AgentInfo; label: string; type: string; placeholder: string }[] = [
  { key: "companyName", label: "会社名",   type: "text", placeholder: "株式会社〇〇不動産" },
  { key: "agentName",   label: "担当者名", type: "text", placeholder: "山田 太郎" },
  { key: "phone",       label: "電話番号", type: "tel",  placeholder: "052-000-0000" },
];

export default function AgentInfoForm({ info, onChange, logoDataUrl, onLogoChange }: Props) {
  const logoRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof AgentInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...info, [key]: e.target.value });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onLogoChange(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <h2 className="text-sm font-semibold text-slate-700">担当者情報</h2>
        <span className="text-xs text-slate-400 ml-1">— PDFに印刷されます</span>
      </div>

      <div className="p-6">
        {/* ロゴアップロード */}
        <div className="mb-5 pb-5 border-b border-slate-100 flex items-start gap-5">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">会社ロゴ</p>
            <div
              onClick={() => logoRef.current?.click()}
              className={[
                "w-32 h-16 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors overflow-hidden",
                logoDataUrl
                  ? "border-slate-200 hover:border-red-300"
                  : "border-slate-300 hover:border-blue-400 hover:bg-blue-50",
              ].join(" ")}
              title={logoDataUrl ? "クリックして変更" : "クリックしてアップロード"}
            >
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="会社ロゴ" className="w-full h-full object-contain p-1" />
              ) : (
                <div className="text-center text-slate-400 p-2">
                  <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs">ロゴ追加</span>
                </div>
              )}
            </div>
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          </div>
          <div className="flex-1 pt-5">
            {logoDataUrl ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-600 font-medium">✓ ロゴ設定済み</span>
                <button
                  onClick={() => onLogoChange("")}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors underline"
                >
                  削除
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                PNG / JPG / SVG 推奨<br />
                PDFのヘッダーに表示されます
              </p>
            )}
          </div>
        </div>

        {/* テキストフィールド */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FIELDS.map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
              <input
                type={type}
                value={info[key]}
                onChange={set(key)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-300"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
