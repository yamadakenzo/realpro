"use client";

import { useState } from "react";
import { LANG_META, LANGUAGES } from "@/lib/translations";
import type { Language } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (lang: Language, glossary: boolean) => void;
}

export default function PdfModal({ isOpen, onClose, onConfirm }: Props) {
  const [lang, setLang] = useState<Language>("ja");
  const [glossary, setGlossary] = useState(true);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* ヘッダー */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">PDF 出力オプション</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            言語を選ぶと ふりがな・カタカナ・ローマ字・母国語訳・通貨換算が自動でセットされます
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 言語選択グリッド */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              ① PDF の言語
            </p>
            <div className="grid grid-cols-4 gap-2">
              {LANGUAGES.map((l) => {
                const meta = LANG_META[l];
                const selected = lang === l;
                return (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={[
                      "flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-center transition-all",
                      selected
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-blue-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span className="text-xl leading-none">{meta.flag}</span>
                    <span className={`text-xs font-medium leading-tight ${selected ? "text-blue-700" : "text-slate-700"}`}>
                      {meta.name}
                    </span>
                    <span className={`text-xs leading-none ${selected ? "text-blue-500" : "text-slate-400"}`}>
                      {meta.currency.symbol} {meta.currency.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 用語解説トグル */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              ② 用語解説
            </p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={glossary}
                  onChange={(e) => setGlossary(e.target.checked)}
                  className="sr-only"
                />
                <div className={[
                  "w-10 h-6 rounded-full transition-colors",
                  glossary ? "bg-blue-500" : "bg-slate-300",
                ].join(" ")} />
                <div className={[
                  "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                  glossary ? "translate-x-5" : "translate-x-1",
                ].join(" ")} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {glossary ? "用語解説を付ける" : "用語解説を付けない"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  敷金・礼金・仲介手数料・保証会社・火災保険の5項目を選んだ言語で解説
                </p>
              </div>
            </label>
          </div>

          {/* 選択中のプレビュー */}
          {lang !== "ja" && (
            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
              <span className="font-medium">PDF に含まれる情報：</span>
              　日本語 ／ ふりがな ／ カタカナ ／ ローマ字 ／ {LANG_META[lang].name}訳
              ／ 円 + {LANG_META[lang].currency.code} 換算{glossary ? " ／ 用語解説" : ""}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => onConfirm(lang, glossary)}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            </svg>
            PDF 出力
          </button>
        </div>
      </div>
    </div>
  );
}
