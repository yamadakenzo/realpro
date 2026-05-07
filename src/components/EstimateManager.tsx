"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentInfo, AnalyzeResponse } from "@/types";

interface SavedEstimate {
  id: string;
  name: string;
  savedAt: string;
  result: AnalyzeResponse;
  agentInfo: AgentInfo;
}

interface Props {
  result: AnalyzeResponse | null;
  agentInfo: AgentInfo;
  onRestore: (result: AnalyzeResponse, agentInfo: AgentInfo) => void;
}

const STORAGE_KEY = "realpro_estimates";

function loadEstimates(): SavedEstimate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedEstimate[]) : [];
  } catch {
    return [];
  }
}

function persist(list: SavedEstimate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const fmt = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export default function EstimateManager({ result, agentInfo, onRestore }: Props) {
  const [estimates, setEstimates] = useState<SavedEstimate[]>([]);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEstimates(loadEstimates());
  }, []);

  // 物件名をデフォルト名に
  useEffect(() => {
    if (result?.extracted.propertyName) {
      setName(result.extracted.propertyName);
    }
  }, [result?.extracted.propertyName]);

  const handleSave = () => {
    if (!result || !name.trim()) return;
    const entry: SavedEstimate = {
      id: Date.now().toString(),
      name: name.trim(),
      savedAt: new Date().toISOString(),
      result,
      agentInfo,
    };
    const updated = [entry, ...estimates];
    setEstimates(updated);
    persist(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = (id: string) => {
    const updated = estimates.filter((e) => e.id !== id);
    setEstimates(updated);
    persist(updated);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">
      {/* 保存エリア（結果がある時のみ） */}
      {result && (
        <div className="px-6 py-5">
          <h3 className="text-base font-semibold text-slate-700 mb-3">見積もりを保存</h3>
          <div className="flex gap-2">
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="見積もり名を入力（例：〇〇マンション101号室）"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className={[
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                name.trim()
                  ? saved
                    ? "bg-emerald-500 text-white"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
              ].join(" ")}
            >
              {saved ? "✓ 保存済み" : "保存する"}
            </button>
          </div>
        </div>
      )}

      {/* 保存済み一覧 */}
      {estimates.length > 0 && (
        <div className="px-6 py-5">
          <h3 className="text-base font-semibold text-slate-700 mb-3">
            保存済み見積もり
            <span className="ml-2 text-xs font-normal text-slate-400">{estimates.length}件</span>
          </h3>
          <ul className="space-y-2">
            {estimates.map((est) => (
              <li
                key={est.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-blue-300 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{est.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(est.savedAt).toLocaleDateString("ja-JP", {
                      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                    　初期費用合計: {fmt(est.result.totalCost)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onRestore(est.result, est.agentInfo)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    復元
                  </button>
                  <button
                    onClick={() => handleDelete(est.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 何もない場合 */}
      {!result && estimates.length === 0 && (
        <div className="px-6 py-5 text-center text-sm text-slate-400">
          保存済みの見積もりはありません
        </div>
      )}
    </div>
  );
}
