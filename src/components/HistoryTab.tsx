"use client";

import type { AgentInfo, AnalyzeResponse, SavedEstimate } from "@/types";

interface Props {
  estimates: SavedEstimate[];
  onRestore: (result: AnalyzeResponse, agentInfo: AgentInfo, est: SavedEstimate) => void;
  onDelete: (id: string) => void;
  onCreateInstagram: (est: SavedEstimate) => void;
  instagramLoadingId?: string | null;
}

const fmt = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export default function HistoryTab({ estimates, onRestore, onDelete, onCreateInstagram, instagramLoadingId }: Props) {
  if (estimates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm font-medium">保存済みの見積もりはありません</p>
        <p className="text-xs mt-1">新規見積もりタブで解析・保存すると、ここに表示されます</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {estimates.map((est) => {
        const monthly = est.result.monthlyCosts.find((c) => c.id === "monthly_total");
        return (
          <div
            key={est.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all overflow-hidden flex flex-col"
          >
            {/* カードヘッダー */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{est.name}</p>
              {est.result.extracted.address && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{est.result.extracted.address}</p>
              )}
              <p className="text-xs text-slate-400 mt-2">
                {new Date(est.savedAt).toLocaleDateString("ja-JP", {
                  year: "numeric", month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>

            {/* 費用サマリー */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-400">初期費用合計</p>
                <p className="text-sm font-bold text-blue-700 font-mono mt-0.5">
                  {fmt(est.result.totalCost)}
                </p>
              </div>
              {monthly && (
                <div className="text-center">
                  <p className="text-xs text-slate-400">月額</p>
                  <p className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                    {fmt(monthly.amount)}
                  </p>
                </div>
              )}
              {est.result.extracted.floorPlan && (
                <div className="text-center">
                  <p className="text-xs text-slate-400">間取り</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">
                    {est.result.extracted.floorPlan}
                  </p>
                </div>
              )}
            </div>

            {/* アクションボタン */}
            <div className="px-4 py-3 flex flex-col gap-2">
              <button
                onClick={() => onCreateInstagram(est)}
                disabled={instagramLoadingId === est.id}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-[#2d5e3a] text-white hover:bg-[#1a2e20] transition-colors disabled:opacity-50"
              >
                {instagramLoadingId === est.id ? "準備中…" : "📸 Instagram投稿を作る"}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => onRestore(est.result, est.agentInfo, est)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  復元して編集
                </button>
                <button
                  onClick={() => onDelete(est.id)}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
