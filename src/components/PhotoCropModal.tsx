"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// スクショ画像の上で長方形をドラッグ → 元画像の実ピクセル解像度で切り出して
// 物件写真（File + object URL）として親へ渡すトリミングモーダル。
// 取り込みは (a) ファイル選択 (b) クリップボード貼り付け(Ctrl+V) の2通り。

type Rect = { x: number; y: number; w: number; h: number };
type DragType = "move" | "draw" | "resize";
type Dir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface Props {
  open: boolean;
  onClose: () => void;
  // 切り出した画像を親に渡す（file は propertyPhotos へ、url は propertyPhotoUrls へ）
  onAdd: (file: File, url: string) => void;
}

const MIN_SIZE = 12; // 表示上の最小選択サイズ(px)
const PNG_MAX_BYTES = 1_500_000; // これを超えたら JPEG 0.9 にフォールバック

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// リサイズ時に方向(dir)に応じて矩形を更新
function resizeRect(o: Rect, dir: Dir, dx: number, dy: number, disp: { w: number; h: number }): Rect {
  let left = o.x;
  let top = o.y;
  let right = o.x + o.w;
  let bottom = o.y + o.h;
  if (dir.includes("w")) left = clamp(o.x + dx, 0, right - MIN_SIZE);
  if (dir.includes("e")) right = clamp(o.x + o.w + dx, left + MIN_SIZE, disp.w);
  if (dir.includes("n")) top = clamp(o.y + dy, 0, bottom - MIN_SIZE);
  if (dir.includes("s")) bottom = clamp(o.y + o.h + dy, top + MIN_SIZE, disp.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

// PNG優先、サイズが大きすぎる場合のみ JPEG 0.9 にフォールバック
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((png) => {
      if (!png) {
        reject(new Error("画像の生成に失敗しました"));
        return;
      }
      if (png.size <= PNG_MAX_BYTES) {
        resolve(png);
        return;
      }
      canvas.toBlob(
        (jpg) => resolve(jpg && jpg.size < png.size ? jpg : png),
        "image/jpeg",
        0.9
      );
    }, "image/png");
  });
}

const HANDLES: { dir: Dir; style: React.CSSProperties; cursor: string }[] = [
  { dir: "nw", style: { left: -6, top: -6 }, cursor: "nwse-resize" },
  { dir: "n", style: { left: "calc(50% - 6px)", top: -6 }, cursor: "ns-resize" },
  { dir: "ne", style: { right: -6, top: -6 }, cursor: "nesw-resize" },
  { dir: "e", style: { right: -6, top: "calc(50% - 6px)" }, cursor: "ew-resize" },
  { dir: "se", style: { right: -6, bottom: -6 }, cursor: "nwse-resize" },
  { dir: "s", style: { left: "calc(50% - 6px)", bottom: -6 }, cursor: "ns-resize" },
  { dir: "sw", style: { left: -6, bottom: -6 }, cursor: "nesw-resize" },
  { dir: "w", style: { left: -6, top: "calc(50% - 6px)" }, cursor: "ew-resize" },
];

export default function PhotoCropModal({ open, onClose, onAdd }: Props) {
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [display, setDisplay] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const srcUrlRef = useRef<string | null>(null);
  const dragRef = useRef<null | {
    type: DragType;
    dir?: Dir;
    startX: number;
    startY: number;
    orig: Rect;
  }>(null);

  // 取り込んだスクショ(object URL)を差し替え/破棄
  const loadFromBlob = useCallback((blob: Blob) => {
    if (srcUrlRef.current) URL.revokeObjectURL(srcUrlRef.current);
    const url = URL.createObjectURL(blob);
    srcUrlRef.current = url;
    setSrcUrl(url);
    setCrop(null);
    setNatural(null);
    setDisplay(null);
    setErrMsg(null);
  }, []);

  // 開閉に応じて内部stateを初期化（閉じたら一時stateを残さない）
  useEffect(() => {
    if (open) {
      setAddedCount(0);
      setErrMsg(null);
    } else {
      if (srcUrlRef.current) {
        URL.revokeObjectURL(srcUrlRef.current);
        srcUrlRef.current = null;
      }
      setSrcUrl(null);
      setNatural(null);
      setDisplay(null);
      setCrop(null);
      dragRef.current = null;
    }
  }, [open]);

  // Escapeで閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // クリップボード貼り付け(Ctrl+V)で画像を取り込み
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            loadFromBlob(f);
            e.preventDefault();
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, loadFromBlob]);

  // ドラッグ中の pointermove / pointerup（window全体で追跡）
  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || !display) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      let { x, y, w, h } = d.orig;
      if (d.type === "move") {
        x = clamp(d.orig.x + dx, 0, Math.max(0, display.w - w));
        y = clamp(d.orig.y + dy, 0, Math.max(0, display.h - h));
      } else if (d.type === "draw") {
        const ax = d.orig.x;
        const ay = d.orig.y;
        const cx = clamp(ax + dx, 0, display.w);
        const cy = clamp(ay + dy, 0, display.h);
        x = Math.min(ax, cx);
        y = Math.min(ay, cy);
        w = Math.abs(cx - ax);
        h = Math.abs(cy - ay);
      } else if (d.type === "resize" && d.dir) {
        const r = resizeRect(d.orig, d.dir, dx, dy, display);
        x = r.x;
        y = r.y;
        w = r.w;
        h = r.h;
      }
      setCrop({ x, y, w, h });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [open, display]);

  // 表示サイズを測定（読み込み時・リサイズ時）。リサイズ時は選択範囲も比例追従。
  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const dW = img.clientWidth;
    const dH = img.clientHeight;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setDisplay((prev) => {
      if (prev && prev.w > 0 && prev.h > 0 && (prev.w !== dW || prev.h !== dH)) {
        const sx = dW / prev.w;
        const sy = dH / prev.h;
        setCrop((c) => (c ? { x: c.x * sx, y: c.y * sy, w: c.w * sx, h: c.h * sy } : c));
      }
      return { w: dW, h: dH };
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, measure]);

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const dW = img.clientWidth;
    const dH = img.clientHeight;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setDisplay({ w: dW, h: dH });
    // 既定の選択範囲：中央60%
    const w = dW * 0.6;
    const h = dH * 0.6;
    setCrop({ x: (dW - w) / 2, y: (dH - h) / 2, w, h });
  };

  // 空き領域ドラッグで新規矩形を描く
  const onWrapPointerDown = (e: React.PointerEvent) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const lx = clamp(e.clientX - rect.left, 0, rect.width);
    const ly = clamp(e.clientY - rect.top, 0, rect.height);
    dragRef.current = {
      type: "draw",
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: lx, y: ly, w: 0, h: 0 },
    };
    setCrop({ x: lx, y: ly, w: 0, h: 0 });
  };

  const onRectPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!crop) return;
    dragRef.current = { type: "move", startX: e.clientX, startY: e.clientY, orig: { ...crop } };
  };

  const onHandlePointerDown = (e: React.PointerEvent, dir: Dir) => {
    e.stopPropagation();
    if (!crop) return;
    dragRef.current = { type: "resize", dir, startX: e.clientX, startY: e.clientY, orig: { ...crop } };
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFromBlob(f);
    e.target.value = "";
  };

  // 選択範囲を元画像の実解像度で切り出して親へ渡す
  const handleAdd = async () => {
    const img = imgRef.current;
    if (!img || !crop || !natural || !display || crop.w < 1 || crop.h < 1) return;
    setBusy(true);
    setErrMsg(null);
    try {
      // 表示座標 → 元画像の実ピクセル座標へスケール換算
      const sx = (crop.x / display.w) * natural.w;
      const sy = (crop.y / display.h) * natural.h;
      const sw = (crop.w / display.w) * natural.w;
      const sh = (crop.h / display.h) * natural.h;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("このブラウザでは切り出しに対応していません");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas);
      const ext = blob.type === "image/jpeg" ? "jpg" : "png";
      const file = new File([blob], `crop-${Date.now()}-${addedCount + 1}.${ext}`, {
        type: blob.type,
      });
      const url = URL.createObjectURL(blob);
      onAdd(file, url);
      setAddedCount((c) => c + 1);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "切り出しに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
      onPointerDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#dce8d4]">
          <h3 className="text-base font-semibold text-[#1a2e20]">📸 スクショから切り出す</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-500 hover:bg-slate-100 flex items-center justify-center text-xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* 本体 */}
        <div className="flex-1 overflow-auto p-5">
          {!srcUrl ? (
            // 取り込み前
            <div className="border-2 border-dashed border-[#b8d898] bg-[#f7faf4] rounded-xl py-12 px-6 text-center">
              <p className="text-sm text-[#1a2e20] mb-1 font-medium">
                スクショを取り込んでください
              </p>
              <p className="text-xs text-[#7a9e82] mb-5">
                <strong>Ctrl + V</strong> で貼り付け（Win+Shift+S で撮ったものをそのまま貼れます）<br />
                またはファイルを選択
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-[#2d5e3a] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                ファイルを選択
              </button>
            </div>
          ) : (
            // 取り込み後（トリミング）
            <div>
              <p className="text-xs text-[#7a9e82] mb-3 text-center">
                画像の上をドラッグして範囲を作成 → 四隅・辺で調整、中央をドラッグで移動
              </p>
              <div className="flex justify-center">
                <div
                  ref={wrapRef}
                  className="relative inline-block select-none"
                  style={{ touchAction: "none", lineHeight: 0 }}
                  onPointerDown={onWrapPointerDown}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={srcUrl}
                    alt="スクリーンショット"
                    onLoad={onImgLoad}
                    draggable={false}
                    className="block"
                    style={{ maxWidth: "100%", maxHeight: "60vh", width: "auto", height: "auto" }}
                  />
                  {/* 選択範囲外を暗くするオーバーレイ（クリックは透過させない＝新規描画用） */}
                  {crop && crop.w > 0 && crop.h > 0 && (
                    <div
                      className="absolute border-2 border-[#2d5e3a] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] cursor-move"
                      style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                      onPointerDown={onRectPointerDown}
                    >
                      {HANDLES.map((hd) => (
                        <div
                          key={hd.dir}
                          onPointerDown={(e) => onHandlePointerDown(e, hd.dir)}
                          className="absolute w-3 h-3 bg-white border-2 border-[#2d5e3a] rounded-sm"
                          style={{ ...hd.style, cursor: hd.cursor }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {errMsg && (
                <p className="text-xs text-red-600 mt-3 text-center">{errMsg}</p>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-[#dce8d4] flex flex-wrap items-center gap-2">
          {srcUrl && (
            <>
              <button
                onClick={handleAdd}
                disabled={busy || !crop || crop.w < 1 || crop.h < 1}
                className={[
                  "px-4 py-2 rounded-xl text-sm font-medium transition-opacity",
                  busy || !crop || crop.w < 1 || crop.h < 1
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-[#2d5e3a] text-white hover:opacity-90",
                ].join(" ")}
              >
                {busy ? "追加中…" : "この範囲を追加"}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl text-sm font-medium border border-[#b8d898] text-[#2d5e3a] hover:bg-[#eaf3de] transition-colors"
              >
                別のスクショを選ぶ
              </button>
              <span className="text-xs text-[#7a9e82] ml-auto">
                このスクショから <strong className="text-[#2d5e3a]">{addedCount}</strong> 枚追加
              </span>
            </>
          )}
          <button
            onClick={onClose}
            className={[
              "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              srcUrl
                ? "border border-slate-300 text-slate-600 hover:bg-slate-100"
                : "ml-auto border border-slate-300 text-slate-600 hover:bg-slate-100",
            ].join(" ")}
          >
            完了 / 閉じる
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
