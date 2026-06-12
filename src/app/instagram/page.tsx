"use client";

import { useEffect, useState } from "react";

// Instagram 投稿プレビュー＆ダウンロード画面。
// 既存の画像API（/api/og/cover|floorplan|spec|cta）とキャプションAPI（/api/og/caption）を読むだけ。
// 物件一覧は GET /api/estimates（認証必須）から取得。番号は og 側と同じ通し順位で算出済み。

type EstimateItem = {
  slug: string;
  number: string;
  propertyName: string;
  address: string;
  roomNumber: string;
  createdAt: string;
};

// ソース記号。未指定（""）は各物件に保存された source（無ければ I）を使う。
// 将来：解析画面で物件ごとに source を設定できるようにすれば、ここでの上書きは不要になる。
const SOURCES = [
  { code: "", label: "物件の設定どおり" },
  { code: "I", label: "イタンジBB（I）" },
  { code: "R", label: "realpro（R）" },
  { code: "A", label: "ATBB（A）" },
];

const SLIDES = [
  { key: "cover", label: "① 表紙" },
  { key: "floorplan", label: "② 間取り" },
  { key: "spec", label: "③ スペック" },
  { key: "cta", label: "④ 問い合わせ" },
];

const GREEN = "#2d5e3a";

export default function InstagramPage() {
  const [list, setList] = useState<EstimateItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [source, setSource] = useState("");
  const [caption, setCaption] = useState("");
  const [number, setNumber] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    fetch("/api/estimates")
      .then((r) => r.json())
      .then((d) => setList(d.estimates ?? []))
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, []);

  // 物件 or ソース記号が変わったらキャプションを取り直し、番号も更新
  useEffect(() => {
    if (!slug) {
      setCaption("");
      setNumber("");
      return;
    }
    setCaptionLoading(true);
    setCopied(false);
    const q = `slug=${encodeURIComponent(slug)}${source ? `&source=${source}` : ""}`;
    fetch(`/api/og/caption?${q}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("failed"))))
      .then((t) => {
        setCaption(t);
        const m = t.match(/【No\. (.+?)】/);
        setNumber(m ? m[1] : "");
      })
      .catch(() => {
        setCaption("（キャプションの取得に失敗しました。slug をご確認ください）");
        setNumber("");
      })
      .finally(() => setCaptionLoading(false));
  }, [slug, source]);

  const imgUrl = (key: string) =>
    `/api/og/${key}?slug=${encodeURIComponent(slug)}${source ? `&source=${source}` : ""}`;

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* クリップボード権限が無い環境では無視 */
    }
  };

  const downloadOne = async (key: string) => {
    const res = await fetch(imgUrl(key));
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${number || "post"}_${key}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadAll = async () => {
    setDownloadingAll(true);
    for (const s of SLIDES) {
      await downloadOne(s.key);
      await new Promise((r) => setTimeout(r, 400)); // 連続DLのブロック回避
    }
    setDownloadingAll(false);
  };

  const selected = list.find((e) => e.slug === slug);

  return (
    <main className="min-h-screen bg-[#f2f4f0] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-[#1a2e20]">Instagram 投稿の作成</h1>
          <p className="mt-1 text-sm text-[#5a7a62]">
            物件を選ぶと、4枚の画像とキャプションが表示されます。画像はダウンロード、キャプションはコピーできます。
          </p>
        </header>

        {/* ===== 物件の選択 ===== */}
        <section className="mb-6 rounded-2xl border border-[#dce8d4] bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[#1a2e20]">1. 物件を選ぶ</h2>

          {/* slug 直接入力 */}
          <form
            className="mb-4 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (slugInput.trim()) setSlug(slugInput.trim());
            }}
          >
            <label className="text-xs text-[#5a7a62]">共有URLの slug を直接入力：</label>
            <input
              type="text"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              placeholder="例: ogtest01"
              className="w-44 rounded-lg border border-[#b8d898] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5e3a]"
            />
            <button
              type="submit"
              className="rounded-lg bg-[#2d5e3a] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              表示
            </button>
          </form>

          {/* 一覧から選択 */}
          {listLoading ? (
            <p className="text-sm text-[#7a9e82]">読み込み中…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-[#7a9e82]">
              保存済みの物件が見つかりません。先に見積もりを「URLで共有」して保存してください。
            </p>
          ) : (
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {list.map((e) => (
                <button
                  key={e.slug}
                  onClick={() => setSlug(e.slug)}
                  className={[
                    "rounded-xl border px-3 py-2 text-left transition-colors",
                    e.slug === slug
                      ? "border-[#2d5e3a] bg-[#f3f9ec]"
                      : "border-[#dce8d4] bg-white hover:bg-[#f7faf4]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[#1a2e20]">
                      {e.propertyName || "（物件名なし）"}
                    </span>
                    <span className="shrink-0 rounded bg-[#2d5e3a] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      No. {e.number}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[#7a9e82]">
                    {e.roomNumber ? `${e.roomNumber}・` : ""}
                    {e.address}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-[#a8c4ae]">{e.slug}</div>
                </button>
              ))}
            </div>
          )}

          {/* ソース記号 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="text-xs text-[#5a7a62]">ソース記号（番号の頭文字）：</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-lg border border-[#b8d898] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5e3a]"
            >
              {SOURCES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-[#a8c4ae]">
              ※ここでの変更は番号の頭文字だけに反映されます（連番は変わりません）
            </span>
          </div>
        </section>

        {!slug ? (
          <p className="rounded-2xl border border-dashed border-[#b8d898] bg-white p-8 text-center text-sm text-[#7a9e82]">
            上から物件を選ぶと、ここに4枚のプレビューとキャプションが表示されます。
          </p>
        ) : (
          <>
            {/* ===== 番号 ＋ 一括DL ===== */}
            <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce8d4] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#5a7a62]">投稿番号</span>
                <span className="rounded-lg bg-[#2d5e3a] px-3 py-1 text-base font-bold text-white">
                  No. {number || "…"}
                </span>
                {selected?.propertyName && (
                  <span className="text-sm text-[#1a2e20]">{selected.propertyName}</span>
                )}
              </div>
              <button
                onClick={downloadAll}
                disabled={downloadingAll}
                className="rounded-xl bg-[#2d5e3a] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {downloadingAll ? "ダウンロード中…" : "4枚まとめてダウンロード"}
              </button>
            </section>

            {/* ===== 4枚プレビュー ===== */}
            <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {SLIDES.map((s) => (
                <div
                  key={s.key}
                  className="overflow-hidden rounded-2xl border border-[#dce8d4] bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-semibold text-[#1a2e20]">{s.label}</span>
                    <button
                      onClick={() => downloadOne(s.key)}
                      className="rounded-md border border-[#b8d898] px-2 py-0.5 text-[11px] text-[#2d5e3a] hover:bg-[#f7faf4]"
                    >
                      ⬇ 保存
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`${slug}-${source}-${s.key}`}
                    src={imgUrl(s.key)}
                    alt={s.label}
                    className="aspect-[1080/1350] w-full bg-slate-100 object-cover"
                  />
                </div>
              ))}
            </section>

            {/* ===== キャプション ===== */}
            <section className="rounded-2xl border border-[#dce8d4] bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#1a2e20]">キャプション</h2>
                <button
                  onClick={copyCaption}
                  className="rounded-lg bg-[#2d5e3a] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  {copied ? "コピーしました！" : "コピー"}
                </button>
              </div>
              <textarea
                value={captionLoading ? "読み込み中…" : caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={20}
                className="w-full resize-y rounded-xl border border-[#dce8d4] p-3 font-mono text-[13px] leading-relaxed text-[#1a2e20] focus:outline-none focus:ring-2 focus:ring-[#2d5e3a]"
                style={{ whiteSpace: "pre-wrap" }}
              />
              <p className="mt-2 text-[11px] text-[#a8c4ae]">
                ※ この場で編集してからコピーもできます（編集内容は保存されません）。
              </p>
            </section>
          </>
        )}

        <footer className="mt-8 text-center text-[11px] text-[#a8c4ae]">Housing JP — Instagram 投稿ツール</footer>
      </div>
    </main>
  );
}
