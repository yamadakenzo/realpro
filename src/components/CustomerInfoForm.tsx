"use client";

import type { CustomerInfo } from "@/types";

interface Props {
  info: CustomerInfo;
  onChange: (info: CustomerInfo) => void;
}

export default function CustomerInfoForm({ info, onChange }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <h2 className="text-sm font-semibold text-slate-700">お客様情報</h2>
        <span className="text-xs text-slate-400 ml-1">— PDFのタイトルに反映されます</span>
      </div>
      <div className="p-6">
        <label className="block text-xs font-medium text-slate-500 mb-1.5">お客様名</label>
        <input
          type="text"
          value={info.customerName}
          onChange={(e) => onChange({ ...info, customerName: e.target.value })}
          placeholder="例: Nguyen Van A"
          className="w-full sm:w-80 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-300"
        />
      </div>
    </div>
  );
}
