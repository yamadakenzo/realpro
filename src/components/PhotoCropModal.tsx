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

// ---- 自動検出（一色背景セグメンテーション）----------------------------------
// 縮小画像でマスク計算 → 連結成分 → 外接矩形 → フィルタ。
// 返す矩形は「元画像の実ピクセル座標」（切り出しはこの座標でそのまま使える）。

// 外周(縁)のピクセルだけにコールバックを適用する
function forEachBorderPixel(
  w: number,
  h: number,
  band: number,
  fn: (x: number, y: number) => void
) {
  for (let y = 0; y < h; y++) {
    if (y < band || y >= h - band) {
      for (let x = 0; x < w; x++) fn(x, y);
    } else {
      for (let x = 0; x < band; x++) fn(x, y);
      for (let x = w - band; x < w; x++) fn(x, y);
    }
  }
}

// 外周ピクセルの最頻色（4bit量子化のビン）を背景色として推定し、
// そのビンに属する外周ピクセルの平均色を返す
function estimateBackground(data: Uint8ClampedArray, w: number, h: number) {
  const band = Math.max(1, Math.round(Math.min(w, h) * 0.04)); // 外周4%
  const counts = new Map<number, number>();
  forEachBorderPixel(w, h, band, (x, y) => {
    const i = (y * w + x) * 4;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  let bestKey = 0;
  let bestCount = -1;
  for (const [k, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      bestKey = k;
    }
  }
  const br = (bestKey >> 8) & 0xf;
  const bgQ = (bestKey >> 4) & 0xf;
  const bb = bestKey & 0xf;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let cnt = 0;
  forEachBorderPixel(w, h, band, (x, y) => {
    const i = (y * w + x) * 4;
    if (data[i] >> 4 === br && data[i + 1] >> 4 === bgQ && data[i + 2] >> 4 === bb) {
      sr += data[i];
      sg += data[i + 1];
      sb += data[i + 2];
      cnt++;
    }
  });
  if (cnt === 0) return { r: data[0], g: data[1], b: data[2] };
  return { r: sr / cnt, g: sg / cnt, b: sb / cnt };
}

function detectPhotoRects(img: HTMLImageElement, natural: { w: number; h: number }): Rect[] {
  // マスク計算は縮小画像で（重い画像対策）。結果は元解像度へ戻す。
  const MAX_DIM = 1100;
  const scale = Math.min(1, MAX_DIM / Math.max(natural.w, natural.h));
  const mw = Math.max(1, Math.round(natural.w * scale));
  const mh = Math.max(1, Math.round(natural.h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = mw;
  canvas.height = mh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("このブラウザでは自動検出に対応していません");
  ctx.drawImage(img, 0, 0, mw, mh);
  const data = ctx.getImageData(0, 0, mw, mh).data;

  // 1) 背景色を推定
  const bg = estimateBackground(data, mw, mh);

  // 2) 前景マスク（背景色からの色距離がしきい値超え＝前景）
  const THRESH_SQ = 52 * 52; // オレンジ背景＋白カードがきれいに分離できる程度
  const n = mw * mh;
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const dr = data[i * 4] - bg.r;
    const dg = data[i * 4 + 1] - bg.g;
    const db = data[i * 4 + 2] - bg.b;
    if (dr * dr + dg * dg + db * db > THRESH_SQ) fg[i] = 1;
  }

  // 3) 連結成分（4近傍 flood fill）→ 外接矩形
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const boxes: { minX: number; minY: number; maxX: number; maxY: number; area: number }[] = [];
  for (let start = 0; start < n; start++) {
    if (fg[start] === 0 || seen[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    let minX = mw;
    let minY = mh;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    while (sp > 0) {
      const p = stack[--sp];
      const px = p % mw;
      const py = (p - px) / mw;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      area++;
      if (px > 0) {
        const q = p - 1;
        if (fg[q] && !seen[q]) {
          seen[q] = 1;
          stack[sp++] = q;
        }
      }
      if (px < mw - 1) {
        const q = p + 1;
        if (fg[q] && !seen[q]) {
          seen[q] = 1;
          stack[sp++] = q;
        }
      }
      if (py > 0) {
        const q = p - mw;
        if (fg[q] && !seen[q]) {
          seen[q] = 1;
          stack[sp++] = q;
        }
      }
      if (py < mh - 1) {
        const q = p + mw;
        if (fg[q] && !seen[q]) {
          seen[q] = 1;
          stack[sp++] = q;
        }
      }
    }
    boxes.push({ minX, minY, maxX, maxY, area });
  }

  // 4) フィルタ（小さすぎ＝文字/ノイズ、大きすぎ＝全体、細長すぎ＝線/枠 を除外）
  const imgArea = mw * mh;
  const MIN_SIDE = Math.max(8, 40 * scale); // 元画像40px相当
  const MIN_AREA_FRAC = 0.004; // 画像全体の0.4%未満は除外
  const MAX_AREA_FRAC = 0.9; // ほぼ全体は除外
  const MAX_ASPECT = 7; // 極端に細長いものは除外
  const MAX_CANDIDATES = 40;
  const rects: Rect[] = [];
  for (const b of boxes) {
    const w = b.maxX - b.minX + 1;
    const h = b.maxY - b.minY + 1;
    if (w < MIN_SIDE || h < MIN_SIDE) continue;
    if (b.area / imgArea < MIN_AREA_FRAC) continue;
    if ((w * h) / imgArea > MAX_AREA_FRAC) continue;
    if (Math.max(w, h) / Math.min(w, h) > MAX_ASPECT) continue;
    // マスク座標 → 元画像の実ピクセル座標
    rects.push({ x: b.minX / scale, y: b.minY / scale, w: w / scale, h: h / scale });
  }
  // 上→下、左→右で並べる（同じ行とみなす許容は元画像20px）
  rects.sort((a, b) => (Math.abs(a.y - b.y) > 20 ? a.y - b.y : a.x - b.x));
  return rects.slice(0, MAX_CANDIDATES);
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
  // 自動検出の候補枠（rect は元画像の実ピクセル座標。手動 crop とは別管理）
  const [candidates, setCandidates] = useState<{ id: number; rect: Rect }[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [noteMsg, setNoteMsg] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const srcUrlRef = useRef<string | null>(null);
  const candIdRef = useRef(0);
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
    setCandidates([]);
    setNatural(null);
    setDisplay(null);
    setErrMsg(null);
    setNoteMsg(null);
  }, []);

  // 開閉に応じて内部stateを初期化（閉じたら一時stateを残さない）
  useEffect(() => {
    if (open) {
      setAddedCount(0);
      setErrMsg(null);
      setNoteMsg(null);
      setCandidates([]);
    } else {
      if (srcUrlRef.current) {
        URL.revokeObjectURL(srcUrlRef.current);
        srcUrlRef.current = null;
      }
      setSrcUrl(null);
      setNatural(null);
      setDisplay(null);
      setCrop(null);
      setCandidates([]);
      setNoteMsg(null);
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
    // 空き領域から手動で枠を引き始めたら自動候補は片付ける（手動モードへ切替）
    if (candidates.length) setCandidates([]);
    if (noteMsg) setNoteMsg(null);
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

  // 元画像の実ピクセル座標の矩形を切り出して親へ渡す（手動・自動の共通処理）
  const emitCrop = useCallback(
    async (nat: Rect, seq: number) => {
      const img = imgRef.current;
      if (!img) throw new Error("画像が読み込まれていません");
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(nat.w));
      canvas.height = Math.max(1, Math.round(nat.h));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("このブラウザでは切り出しに対応していません");
      ctx.drawImage(img, nat.x, nat.y, nat.w, nat.h, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas);
      const ext = blob.type === "image/jpeg" ? "jpg" : "png";
      const file = new File([blob], `crop-${Date.now()}-${seq}.${ext}`, { type: blob.type });
      const url = URL.createObjectURL(blob);
      onAdd(file, url);
    },
    [onAdd]
  );

  // 手動：選択範囲を元画像の実解像度で切り出して親へ渡す
  const handleAdd = async () => {
    if (!crop || !natural || !display || crop.w < 1 || crop.h < 1) return;
    setBusy(true);
    setErrMsg(null);
    try {
      // 表示座標 → 元画像の実ピクセル座標へスケール換算
      const nat: Rect = {
        x: (crop.x / display.w) * natural.w,
        y: (crop.y / display.h) * natural.h,
        w: (crop.w / display.w) * natural.w,
        h: (crop.h / display.h) * natural.h,
      };
      await emitCrop(nat, addedCount + 1);
      setAddedCount((c) => c + 1);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "切り出しに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  // 自動：いま読み込んでいるスクショを解析して写真っぽい四角を候補として出す
  const handleDetect = () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    setDetecting(true);
    setErrMsg(null);
    setNoteMsg(null);
    try {
      const rects = detectPhotoRects(img, natural);
      if (rects.length === 0) {
        setCandidates([]);
        setNoteMsg("自動で見つかりませんでした。手動で枠を引いてください。");
      } else {
        // 手動枠の暗幕を消して候補を見やすくする
        setCrop(null);
        setCandidates(rects.map((r) => ({ id: candIdRef.current++, rect: r })));
      }
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "自動検出に失敗しました");
    } finally {
      setDetecting(false);
    }
  };

  const removeCandidate = (id: number) =>
    setCandidates((cs) => cs.filter((c) => c.id !== id));

  // 残っている候補枠をまとめて切り出して追加（既存の切り出しロジックを再利用）
  const handleAddAll = async () => {
    if (candidates.length === 0) return;
    setBusy(true);
    setErrMsg(null);
    try {
      let seq = addedCount;
      for (const c of candidates) {
        seq++;
        await emitCrop(c.rect, seq);
      }
      setAddedCount(seq);
      setCandidates([]);
      setNoteMsg(null);
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
              {candidates.length > 0 ? (
                <p className="text-xs text-[#b45309] mb-3 text-center">
                  <strong className="text-[#e08a00]">オレンジの破線</strong>が自動検出した候補です。要らない枠は{" "}
                  <strong>×</strong> で消せます。画像をドラッグすると手動の枠に切り替わります。
                </p>
              ) : (
                <p className="text-xs text-[#7a9e82] mb-3 text-center">
                  「✨ 自動で検出」を押すか、画像の上をドラッグして範囲を作成（四隅・辺で調整、中央で移動）
                </p>
              )}
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
                  {/* 自動検出の候補枠（手動枠とは色違い。各枠に × で個別削除） */}
                  {display &&
                    natural &&
                    candidates.map((c) => {
                      const rx = display.w / natural.w;
                      const ry = display.h / natural.h;
                      return (
                        <div
                          key={c.id}
                          className="absolute border-2 border-dashed border-[#e08a00] bg-[#e08a00]/10"
                          style={{
                            left: c.rect.x * rx,
                            top: c.rect.y * ry,
                            width: c.rect.w * rx,
                            height: c.rect.h * ry,
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => removeCandidate(c.id)}
                            className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-[#e08a00] text-white text-sm leading-none flex items-center justify-center shadow hover:bg-[#c57700]"
                            aria-label="この候補を消す"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {noteMsg && (
                <p className="text-xs text-[#b45309] mt-3 text-center">{noteMsg}</p>
              )}
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
                onClick={handleDetect}
                disabled={busy || detecting || !natural}
                className={[
                  "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                  busy || detecting || !natural
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-[#fff3e0] text-[#b45309] border border-[#e08a00] hover:bg-[#ffe8c7]",
                ].join(" ")}
              >
                {detecting ? "検出中…" : "✨ 自動で検出"}
              </button>
              {candidates.length > 0 && (
                <>
                  <button
                    onClick={handleAddAll}
                    disabled={busy}
                    className={[
                      "px-4 py-2 rounded-xl text-sm font-medium transition-opacity",
                      busy
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-[#e08a00] text-white hover:opacity-90",
                    ].join(" ")}
                  >
                    {busy ? "追加中…" : `検出した ${candidates.length}枚をまとめて追加`}
                  </button>
                  <button
                    onClick={() => {
                      setCandidates([]);
                      setNoteMsg(null);
                    }}
                    disabled={busy}
                    className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    候補をクリア
                  </button>
                </>
              )}
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
