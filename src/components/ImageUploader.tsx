"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";

interface Props {
  onAnalyze: (files: File[]) => void;
  loading: boolean;
}

interface Preview {
  file: File;
  url: string;
}

export default function ImageUploader({ onAnalyze, loading }: Props) {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[]) => {
    const newPreviews = Array.from(incoming).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
      <h2 className="text-base font-semibold text-slate-700">
        Step 1 — スクリーンショットをアップロード（複数枚可）
      </h2>

      {/* ドロップゾーン */}
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={[
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed",
          "cursor-pointer transition-colors py-8 px-4 text-center",
          dragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 hover:border-blue-400 hover:bg-slate-50",
        ].join(" ")}
      >
        <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium text-slate-500">クリック または ドラッグ＆ドロップ</p>
        <p className="text-xs text-slate-400 mt-1">JPEG / PNG / WebP 対応・複数枚選択可</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {/* サムネイルグリッド */}
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {previews.map((p, i) => (
            <div key={p.url} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
              <img src={p.url} alt={p.file.name} className="w-full h-28 object-cover" />
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow hover:bg-red-600 transition-colors"
                aria-label="削除"
              >
                ×
              </button>
              <p className="text-xs text-slate-400 truncate px-1.5 py-1">{p.file.name}</p>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => previews.length && onAnalyze(previews.map((p) => p.file))}
        disabled={previews.length === 0 || loading}
        className={[
          "w-full py-3 rounded-xl text-sm font-semibold transition-colors",
          previews.length > 0 && !loading
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-slate-100 text-slate-400 cursor-not-allowed",
        ].join(" ")}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            読み取り中…
          </span>
        ) : (
          <>
            解析する
            {previews.length > 1 && (
              <span className="ml-2 text-blue-200 font-normal">（{previews.length}枚）</span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
