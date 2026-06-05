import { supabase } from "@/lib/supabase";
import { geocodeAddress } from "@/lib/geocode";
import {
  SECTION, COST_LABELS, MONTHLY_LABELS, COST_NOTE_LABELS,
  COST_BILINGUAL_KEY, MONTHLY_BILINGUAL_KEY, T, bilingual, LANGUAGES,
} from "@/lib/translations";
import type {
  AgentInfo, AnalyzeResponse, CostItem, CustomerInfo, Language, MonthlyItem,
} from "@/types";

type SharedEstimate = {
  result?: AnalyzeResponse;
  agentInfo?: AgentInfo;
  customerInfo?: CustomerInfo;
  comment?: string;
  validUntil?: string;
  propertyPhotoUrls?: string[];
};

type EstimateRow = {
  slug: string;
  data: SharedEstimate;
  created_at: string;
  expires_at: string | null;
};

const yen = (n: number) => `¥${(n ?? 0).toLocaleString("ja-JP")}`;

async function fetchEstimate(slug: string): Promise<EstimateRow | null> {
  const { data, error } = await supabase
    .from("estimates")
    .select("slug, data, created_at, expires_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  return data as EstimateRow;
}

function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#dce8d4] p-8 max-w-sm w-full text-center shadow-sm">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0l-7.07 12a2 2 0 001.74 3z" />
          </svg>
        </div>
        <h1 className="text-base font-semibold text-[#1a2e20] mb-2">
          見積もりが見つかりません
        </h1>
        <p className="text-sm text-[#7a9e82] leading-relaxed">
          この見積もりは存在しないか、期限切れです。
        </p>
      </div>
    </div>
  );
}

export default async function EstimateViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  // 共有URLの ?lang= で顧客言語を受け取る（/compare と同じ方式）。未指定・不正は日本語のみ
  const lang: Language = LANGUAGES.includes(sp.lang as Language) ? (sp.lang as Language) : "ja";

  const row = await fetchEstimate(slug);
  if (!row) return <NotFound />;

  const {
    result, agentInfo, customerInfo, comment, validUntil, propertyPhotoUrls,
  } = row.data ?? {};

  if (!result) return <NotFound />;

  const prop = result.extracted;
  const costs: CostItem[] = (result.costs ?? []).filter((c) => c.amount > 0);
  const monthly: MonthlyItem[] = result.monthlyCosts ?? [];
  const monthlyTotal = monthly.find((m) => m.id === "monthly_total");
  const monthlyOthers = monthly.filter((m) => m.id !== "monthly_total");
  const photos = (propertyPhotoUrls ?? []).filter((u) => typeof u === "string" && u.length > 0);
  const salesPoints = prop.salesPoints ?? [];

  // 物件位置の地図。住所→座標に変換できた時だけ表示（取れなければ地図セクションを出さない）。
  // 画像は /api/staticmap 経由で取得するのでAPIキーはHTMLに出ない。
  const mapLoc = prop.address ? await geocodeAddress(prop.address) : null;

  // ── 多言語ヘルパー：日本語＋（顧客言語）の併記を作る（PDFと同じ方針） ──
  const bi = (ja: string, tr?: string): string =>
    lang === "ja" || !tr || tr === ja ? ja : `${ja}（${tr}）`;
  const sec = (key: string): string => bi(SECTION[key]?.ja ?? key, SECTION[key]?.[lang]);
  const itemLabel = (c: CostItem): string =>
    bilingual(COST_LABELS[c.id]?.ja ?? c.label, COST_BILINGUAL_KEY[c.id], lang);
  const monthlyLabel = (m: MonthlyItem): string =>
    bilingual(MONTHLY_LABELS[m.id]?.ja ?? m.label, MONTHLY_BILINGUAL_KEY[m.id], lang);
  const noteLabel = (note: string): string => bi(note, COST_NOTE_LABELS[note]?.[lang]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#f7f9f4] border-b border-[#dce8d4]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#2d5e3a] rounded-[9px] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[15px] font-medium text-[#1a2e20] tracking-tight">
                {sec("reportTitle")}
              </h1>
              {prop.propertyName && (
                <p className="text-[12px] text-[#5a7a62] mt-0.5 truncate">{prop.propertyName}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {customerInfo?.customerName && (
          <p className="text-sm text-[#1a2e20]">
            {customerInfo.customerName}{lang === "ja" ? " 様" : ""}
          </p>
        )}

        {/* セールスポイント（金銭メリット・強い特徴） */}
        {salesPoints.length > 0 && (
          <section className="bg-[#f3f9ec] rounded-xl border border-[#b8d898] p-4">
            <h2 className="text-sm font-bold text-[#2d5e3a] mb-2">
              ✨ {bi("セールスポイント", T[lang]?.salesPoints)}
            </h2>
            <div className="flex flex-wrap gap-2">
              {salesPoints.map((spt) => (
                <span
                  key={spt}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-[#2d5e3a] text-white"
                >
                  {spt}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 物件写真ギャラリー */}
        {photos.length > 0 && (
          <section className="bg-white rounded-xl border border-[#dce8d4] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#eaf3de] bg-[#f7faf4] flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-[#1a2e20]">{sec("propertyPhotos")}</h2>
              <span className="text-xs text-[#7a9e82]">
                {photos.length}{lang === "ja" ? " 枚" : ""}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto p-3 snap-x snap-mandatory">
              {photos.map((url, i) => (
                <img
                  key={`${url}-${i}`}
                  src={url}
                  alt={`${prop.propertyName || "property"} ${i + 1}`}
                  className="max-h-64 h-64 w-auto object-cover rounded-lg shrink-0 snap-start bg-[#f7faf4]"
                />
              ))}
            </div>
          </section>
        )}

        {/* 物件情報 */}
        {(prop.propertyName || prop.address || prop.floorPlan || prop.area > 0 || prop.roomNumber) && (
          <section className="bg-white rounded-xl border border-[#dce8d4] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#eaf3de] bg-[#f7faf4]">
              <h2 className="text-sm font-semibold text-[#1a2e20]">{sec("propertyInfo")}</h2>
            </div>
            <dl className="divide-y divide-[#eaf3de] text-sm">
              {prop.propertyName && (
                <div className="px-4 py-2.5 flex">
                  <dt className="w-28 shrink-0 text-[#7a9e82]">{sec("propertyName")}</dt>
                  <dd className="text-[#1a2e20] flex-1">{prop.propertyName}</dd>
                </div>
              )}
              {prop.roomNumber && (
                <div className="px-4 py-2.5 flex">
                  <dt className="w-28 shrink-0 text-[#7a9e82]">{sec("roomNumber")}</dt>
                  <dd className="text-[#1a2e20] flex-1">{prop.roomNumber}</dd>
                </div>
              )}
              {prop.address && (
                <div className="px-4 py-2.5 flex">
                  <dt className="w-28 shrink-0 text-[#7a9e82]">{sec("address")}</dt>
                  <dd className="text-[#1a2e20] flex-1">{prop.address}</dd>
                </div>
              )}
              {prop.floorPlan && (
                <div className="px-4 py-2.5 flex">
                  <dt className="w-28 shrink-0 text-[#7a9e82]">{sec("floorPlan")}</dt>
                  <dd className="text-[#1a2e20] flex-1">{prop.floorPlan}</dd>
                </div>
              )}
              {prop.area > 0 && (
                <div className="px-4 py-2.5 flex">
                  <dt className="w-28 shrink-0 text-[#7a9e82]">{sec("area")}</dt>
                  <dd className="text-[#1a2e20] flex-1">{prop.area} m²</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* 地図（住所→座標に変換できた時だけ。タップでGoogleマップが開く。画像はサーバー経由でキー非露出） */}
        {mapLoc && (
          <section className="bg-white rounded-xl border border-[#dce8d4] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#eaf3de] bg-[#f7faf4]">
              <h2 className="text-sm font-semibold text-[#1a2e20]">{sec("mapTitle")}</h2>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapLoc.lat},${mapLoc.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={`/api/staticmap?lat=${mapLoc.lat}&lng=${mapLoc.lng}&lang=${lang}`}
                alt={sec("mapTitle")}
                className="w-full h-56 object-cover"
              />
            </a>
          </section>
        )}

        {/* 初期費用 */}
        <section className="bg-white rounded-xl border border-[#dce8d4] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#eaf3de] bg-[#f7faf4] flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#1a2e20]">{sec("initialCosts")}</h2>
            <span className="text-xs text-[#7a9e82]">
              {costs.length}{lang === "ja" ? " 項目" : ""}
            </span>
          </div>
          <ul className="divide-y divide-[#eaf3de]">
            {costs.map((c) => (
              <li key={c.id} className="px-4 py-2.5 flex items-baseline gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-[#1a2e20]">{itemLabel(c)}</p>
                  {c.note && <p className="text-[11px] text-[#7a9e82] mt-0.5">{noteLabel(c.note)}</p>}
                </div>
                <p className="font-medium tabular-nums text-[#1a2e20]">{yen(c.amount)}</p>
              </li>
            ))}
          </ul>
          <div className="px-4 py-3 bg-[#eaf3de] flex items-baseline justify-between">
            <span className="text-sm font-semibold text-[#1a2e20]">{sec("totalInitial")}</span>
            <span className="text-base font-bold tabular-nums text-[#27500a]">
              {yen(result.totalCost)}
            </span>
          </div>
        </section>

        {/* 月額費用 */}
        {monthlyOthers.length > 0 && (
          <section className="bg-white rounded-xl border border-[#dce8d4] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#eaf3de] bg-[#f7faf4]">
              <h2 className="text-sm font-semibold text-[#1a2e20]">{sec("monthlyCosts")}</h2>
            </div>
            <ul className="divide-y divide-[#eaf3de]">
              {monthlyOthers.map((m) => (
                <li key={m.id} className="px-4 py-2.5 flex items-baseline justify-between text-sm">
                  <span className="text-[#1a2e20]">{monthlyLabel(m)}</span>
                  <span className="font-medium tabular-nums text-[#1a2e20]">{yen(m.amount)}</span>
                </li>
              ))}
            </ul>
            {monthlyTotal && (
              <div className="px-4 py-3 bg-[#eaf3de] flex items-baseline justify-between">
                <span className="text-sm font-semibold text-[#1a2e20]">{monthlyLabel(monthlyTotal)}</span>
                <span className="text-base font-bold tabular-nums text-[#27500a]">
                  {yen(monthlyTotal.amount)}
                </span>
              </div>
            )}
          </section>
        )}

        {comment && (
          <section className="bg-white rounded-xl border border-[#dce8d4] p-4">
            <h2 className="text-sm font-semibold text-[#1a2e20] mb-2">{sec("agentComment")}</h2>
            <p className="text-sm text-[#1a2e20] whitespace-pre-wrap leading-relaxed">{comment}</p>
          </section>
        )}

        {(agentInfo?.companyName || agentInfo?.agentName || agentInfo?.phone || validUntil) && (
          <section className="bg-white rounded-xl border border-[#dce8d4] p-4 text-sm space-y-1">
            {validUntil && (
              <p className="text-[#5a7a62]">
                {sec("validUntil")}：
                <span className="text-[#1a2e20]">
                  {new Date(validUntil).toLocaleDateString("ja-JP")}
                </span>
              </p>
            )}
            {(agentInfo?.companyName || agentInfo?.agentName) && (
              <p className="text-[#5a7a62]">
                {sec("agentName")}：
                <span className="text-[#1a2e20]">
                  {[agentInfo?.companyName, agentInfo?.agentName].filter(Boolean).join(" / ")}
                </span>
              </p>
            )}
            {agentInfo?.phone && (
              <p className="text-[#5a7a62]">
                {sec("phone")}：<span className="text-[#1a2e20]">{agentInfo.phone}</span>
              </p>
            )}
          </section>
        )}

        <p className="text-[11px] text-[#7a9e82] leading-relaxed pt-2">
          ※ 本見積書は概算です。実際の費用は変動する場合があります。詳細は担当者にご確認ください。
          {lang !== "ja" && T[lang]?.customerDisclaimer && (
            <span className="block mt-1">{T[lang].customerDisclaimer}</span>
          )}
        </p>
      </main>
    </div>
  );
}
