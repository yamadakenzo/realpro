"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Instagram 投稿プレビュー＆ダウンロード画面。
// 既存の画像API（/api/og/cover|floorplan|spec|cta）とキャプションAPI（/api/og/caption）を読むだけ。
// 物件一覧は GET /api/estimates（認証必須）。ソース保存は POST /api/estimates/source、
// 間取り写真の保存は PATCH /api/estimates/[slug]、削除（論理削除）は DELETE /api/estimates/[slug]。

type EstimateItem = {
  slug: string;
  number: string;
  propertyName: string;
  address: string;
  roomNumber: string;
  createdAt: string;
};

const SOURCES = [
  { code: "itandi", label: "イタンジBB（T）" },
  { code: "atbb", label: "ATBB（A）" },
  { code: "realpro", label: "realpro（P）" },
];
const LETTER_TO_CODE: Record<string, string> = { T: "itandi", A: "atbb", P: "realpro" };

const SLIDES = [
  { key: "cover", label: "① 表紙" },
  { key: "floorplan", label: "② 間取り" },
  { key: "spec", label: "③ スペック" },
  { key: "cta", label: "④ 問い合わせ" },
];

function InstagramInner() {
  const searchParams = useSearchParams();

  const [list, setList] = useState<EstimateItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [propSource, setPropSource] = useState("itandi");
  const [saving, setSaving] = useState(false);
  const [sourceMsg, setSourceMsg] = useState("");
  const [version, setVersion] = useState(0);
  const [caption, setCaption] = useState("");
  const [number, setNumber] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  // 写真ピッカー（表紙＝1枚目／間取り図＝2枚目）
  const [photos, setPhotos] = useState<string[]>([]);
  const [floorIndex, setFloorIndex] = useState<number | null>(null);
  const [savingFloor, setSavingFloor] = useState(false);
  const [floorMsg, setFloorMsg] = useState("");
  const [coverIndex, setCoverIndex] = useState<number | null>(null);
  const [savingCover, setSavingCover] = useState(false);
  const [coverMsg, setCoverMsg] = useState("");

  const loadList = () => {
    setListLoading(true);
    fetch("/api/estimates")
      .then((r) => r.json())
      .then((d) => setList(d.estimates ?? []))
      .catch(() => {})
      .finally(() => setListLoading(false));
  };
  useEffect(loadList, []);

  const selectSlug = (s: string, currentNumber?: string) => {
    setSlug(s);
    setSourceMsg("");
    setFloorMsg("");
    setCoverMsg("");
    const letter = (currentNumber ?? "").split("-")[0];
    setPropSource(LETTER_TO_CODE[letter] ?? "itandi");
  };

  // 履歴/メイン画面から ?slug= で渡された物件を自動選択
  useEffect(() => {
    const qs = searchParams.get("slug");
    if (qs) selectSlug(qs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // キャプション取得（番号・ソース選択を同期）
  useEffect(() => {
    if (!slug) {
      setCaption("");
      setNumber("");
      return;
    }
    setCaptionLoading(true);
    setCopied(false);
    fetch(`/api/og/caption?slug=${encodeURIComponent(slug)}&v=${version}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("failed"))))
      .then((t) => {
        setCaption(t);
        const m = t.match(/【No\. (.+?)】/);
        const num = m ? m[1] : "";
        setNumber(num);
        const letter = num.split("-")[0];
        if (LETTER_TO_CODE[letter]) setPropSource(LETTER_TO_CODE[letter]);
      })
      .catch(() => {
        setCaption("（キャプションの取得に失敗しました。slug をご確認ください）");
        setNumber("");
      })
      .finally(() => setCaptionLoading(false));
  }, [slug, version]);

  // 写真一覧＋保存済み表紙/間取りindexを取得（ピッカー用）
  useEffect(() => {
    if (!slug) {
      setPhotos([]);
      setFloorIndex(null);
      setCoverIndex(null);
      return;
    }
    fetch(`/api/estimates/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setPhotos(d?.photos ?? []);
        setFloorIndex(typeof d?.floorIndex === "number" ? d.floorIndex : null);
        setCoverIndex(typeof d?.coverIndex === "number" ? d.coverIndex : null);
      })
      .catch(() => {
        setPhotos([]);
        setFloorIndex(null);
        setCoverIndex(null);
      });
  }, [slug, version]);

  const imgUrl = (key: string) => {
    let u = `/api/og/${key}?slug=${encodeURIComponent(slug)}&v=${version}`;
    if (key === "floorplan" && floorIndex != null) u += `&floorIndex=${floorIndex}`;
    if (key === "cover" && coverIndex != null) u += `&coverIndex=${coverIndex}`;
    return u;
  };

  // 既定（保存値が無いとき）：間取り図は最後の写真、表紙は最初の写真
  const effectiveFloorIndex = floorIndex != null ? floorIndex : photos.length > 0 ? photos.length - 1 : -1;
  const effectiveCoverIndex = coverIndex != null ? coverIndex : photos.length > 0 ? 0 : -1;

  const saveSource = async () => {
    if (!slug || saving) return;
    setSaving(true);
    setSourceMsg("");
    try {
      const res = await fetch("/api/estimates/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, source: propSource }),
      });
      const d = await res.json();
      if (!res.ok || !d.number) throw new Error(d.error ?? "保存に失敗しました");
      setNumber(d.number);
      setSourceMsg(`保存しました（No. ${d.number}）`);
      setList((prev) => prev.map((e) => (e.slug === slug ? { ...e, number: d.number } : e)));
      setVersion((v) => v + 1);
    } catch {
      setSourceMsg("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const saveFloor = async () => {
    if (!slug || floorIndex == null || savingFloor) return;
    setSavingFloor(true);
    setFloorMsg("");
    try {
      const res = await fetch(`/api/estimates/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floorIndex }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "失敗");
      setFloorMsg("間取り図に使う写真を保存しました");
      setVersion((v) => v + 1);
    } catch {
      setFloorMsg("保存に失敗しました");
    } finally {
      setSavingFloor(false);
    }
  };

  const saveCover = async () => {
    if (!slug || coverIndex == null || savingCover) return;
    setSavingCover(true);
    setCoverMsg("");
    try {
      const res = await fetch(`/api/estimates/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverIndex }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "失敗");
      setCoverMsg("表紙に使う写真を保存しました");
      setVersion((v) => v + 1);
    } catch {
      setCoverMsg("保存に失敗しました");
    } finally {
      setSavingCover(false);
    }
  };

  const deleteEstimate = async (e: EstimateItem) => {
    const ok = window.confirm(
      `「${e.propertyName || e.slug}」を一覧から削除します。よろしいですか？\n（共有URL・Instagram画像も表示されなくなります）`,
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/estimates/${encodeURIComponent(e.slug)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setList((prev) => prev.filter((x) => x.slug !== e.slug));
      if (slug === e.slug) setSlug("");
    } catch {
      window.alert("削除に失敗しました。もう一度お試しください。");
    }
  };

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
      await new Promise((r) => setTimeout(r, 400));
    }
    setDownloadingAll(false);
  };

  const selected = list.find((e) => e.slug === slug);

  return (
    <main className="min-h-screen bg-[#f2f4f0] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          {/* 戻る導線：物件が選択中ならその見積もりページ、未選択なら realpro メインへ */}
          <nav className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <Link href="/" className="inline-flex items-center gap-1 text-[#2d5e3a] hover:underline">
              ← realpro メイン画面へ
            </Link>
            {slug && (
              <Link
                href={`/estimate/${encodeURIComponent(slug)}`}
                className="inline-flex items-center gap-1 text-[#2d5e3a] hover:underline"
              >
                この物件の見積もりページを開く →
              </Link>
            )}
          </nav>
          <h1 className="text-xl font-bold text-[#1a2e20]">Instagram 投稿の作成</h1>
          <p className="mt-1 text-sm text-[#5a7a62]">
            物件を選ぶと、4枚の画像とキャプションが表示されます。画像はダウンロード、キャプションはコピーできます。
          </p>
        </header>

        {/* ===== 物件の選択 ===== */}
        <section className="mb-6 rounded-2xl border border-[#dce8d4] bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[#1a2e20]">1. 物件を選ぶ</h2>

          <form
            className="mb-4 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (slugInput.trim()) selectSlug(slugInput.trim());
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

          {listLoading ? (
            <p className="text-sm text-[#7a9e82]">読み込み中…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-[#7a9e82]">
              保存済みの物件が見つかりません。先に見積もりを「URLで共有」または「Instagram投稿を作る」で保存してください。
            </p>
          ) : (
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {list.map((e) => (
                <div
                  key={e.slug}
                  className={[
                    "rounded-xl border transition-colors",
                    e.slug === slug ? "border-[#2d5e3a] bg-[#f3f9ec]" : "border-[#dce8d4] bg-white hover:bg-[#f7faf4]",
                  ].join(" ")}
                >
                  <button onClick={() => selectSlug(e.slug, e.number)} className="block w-full px-3 py-2 text-left">
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
                  </button>
                  <div className="flex items-center justify-between border-t border-[#e5e9e2] px-3 py-1.5">
                    <span className="truncate text-[10px] text-[#a8c4ae]">{e.slug}</span>
                    <button
                      onClick={() => deleteEstimate(e)}
                      className="shrink-0 rounded-md px-2 py-0.5 text-[11px] text-slate-500 hover:bg-red-50 hover:text-red-600"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 取得元（ソース）の選択＋保存 */}
          {slug && (
            <div className="mt-4 rounded-xl border border-[#dce8d4] bg-[#f7faf4] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-[#1a2e20]">この物件の取得元（番号の記号）：</label>
                <select
                  value={propSource}
                  onChange={(e) => setPropSource(e.target.value)}
                  className="rounded-lg border border-[#b8d898] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5e3a]"
                >
                  {SOURCES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={saveSource}
                  disabled={saving}
                  className="rounded-lg bg-[#2d5e3a] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "保存中…" : "このソースで保存"}
                </button>
                {sourceMsg && <span className="text-xs text-[#2d5e3a]">{sourceMsg}</span>}
              </div>
              <p className="mt-1.5 text-[11px] text-[#a8c4ae]">
                ※ 保存すると番号の頭文字（T / A / P）が確定し、4枚の画像・キャプションに反映されます。連番は変わりません。
              </p>
            </div>
          )}
        </section>

        {!slug ? (
          <p className="rounded-2xl border border-dashed border-[#b8d898] bg-white p-8 text-center text-sm text-[#7a9e82]">
            上から物件を選ぶと、ここに4枚のプレビューとキャプションが表示されます。
          </p>
        ) : (
          <>
            {/* ===== 表紙に使う写真を選ぶ ===== */}
            {photos.length > 0 && (
              <section className="mb-4 rounded-2xl border border-[#dce8d4] bg-white p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[#1a2e20]">表紙に使う写真を選ぶ（1枚目に表示）</h2>
                  <div className="flex items-center gap-2">
                    {coverMsg && <span className="text-xs text-[#2d5e3a]">{coverMsg}</span>}
                    <button
                      onClick={saveCover}
                      disabled={savingCover || coverIndex == null}
                      className="rounded-lg bg-[#2d5e3a] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {savingCover ? "保存中…" : "この写真を表紙に保存"}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setCoverIndex(i)}
                      className={[
                        "relative overflow-hidden rounded-lg border-2 transition-colors",
                        i === effectiveCoverIndex ? "border-[#2d5e3a]" : "border-transparent hover:border-[#b8d898]",
                      ].join(" ")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`写真${i + 1}`} className="aspect-square w-full object-cover" />
                      {i === effectiveCoverIndex && (
                        <span className="absolute bottom-0 left-0 right-0 bg-[#2d5e3a] py-0.5 text-center text-[10px] font-medium text-white">
                          表紙
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-[#a8c4ae]">
                  ※ 写真をクリックすると下のプレビュー（1枚目）に反映されます。「保存」で次回も維持されます（未保存時は最初の写真）。
                </p>
              </section>
            )}

            {/* ===== 間取り図に使う写真を選ぶ ===== */}
            {photos.length > 0 && (
              <section className="mb-4 rounded-2xl border border-[#dce8d4] bg-white p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[#1a2e20]">間取り図に使う写真を選ぶ（2枚目に表示）</h2>
                  <div className="flex items-center gap-2">
                    {floorMsg && <span className="text-xs text-[#2d5e3a]">{floorMsg}</span>}
                    <button
                      onClick={saveFloor}
                      disabled={savingFloor || floorIndex == null}
                      className="rounded-lg bg-[#2d5e3a] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {savingFloor ? "保存中…" : "この写真を間取り図に保存"}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setFloorIndex(i)}
                      className={[
                        "relative overflow-hidden rounded-lg border-2 transition-colors",
                        i === effectiveFloorIndex ? "border-[#2d5e3a]" : "border-transparent hover:border-[#b8d898]",
                      ].join(" ")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`写真${i + 1}`} className="aspect-square w-full object-cover" />
                      {i === effectiveFloorIndex && (
                        <span className="absolute bottom-0 left-0 right-0 bg-[#2d5e3a] py-0.5 text-center text-[10px] font-medium text-white">
                          間取り図
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-[#a8c4ae]">
                  ※ 写真をクリックすると下のプレビュー（2枚目）に反映されます。「保存」で次回も維持されます（未保存時は最後の写真）。
                </p>
              </section>
            )}

            {/* ===== 番号 ＋ 一括DL ===== */}
            <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce8d4] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#5a7a62]">投稿番号</span>
                <span className="rounded-lg bg-[#2d5e3a] px-3 py-1 text-base font-bold text-white">
                  No. {number || "…"}
                </span>
                {selected?.propertyName && <span className="text-sm text-[#1a2e20]">{selected.propertyName}</span>}
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
                <div key={s.key} className="overflow-hidden rounded-2xl border border-[#dce8d4] bg-white shadow-sm">
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
                    key={`${slug}-${version}-${floorIndex}-${coverIndex}-${s.key}`}
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

export default function InstagramPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f2f4f0] p-8 text-sm text-[#7a9e82]">読み込み中…</main>}>
      <InstagramInner />
    </Suspense>
  );
}
