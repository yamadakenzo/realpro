import { supabase } from "@/lib/supabase";
import type {
  AgentInfo, AnalyzeResponse, CustomerInfo, Language, NearbyResult,
} from "@/types";
import { T } from "@/lib/translations";
import CompareView, { type CompareEntry } from "./CompareView";

type SharedEstimate = {
  result?: AnalyzeResponse;
  agentInfo?: AgentInfo;
  customerInfo?: CustomerInfo;
  comment?: string;
  validUntil?: string;
  propertyPhotoUrls?: string[];
  // 共有URL生成時には未保存だが、将来拡張で含まれることがある
  nearby?: NearbyResult;
};

type EstimateRow = {
  slug: string;
  data: SharedEstimate;
  expires_at: string | null;
};

const LANG_CODES: Language[] = [
  "ja", "en", "zh", "zh-tw", "ko", "vi", "ne", "es", "pt", "id",
];

function parseLang(raw: string | undefined): Language {
  if (!raw) return "ja";
  return (LANG_CODES as string[]).includes(raw) ? (raw as Language) : "ja";
}

function parseSlugs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 5);
}

async function fetchEstimates(slugs: string[]): Promise<CompareEntry[]> {
  if (slugs.length === 0) return [];

  const { data, error } = await supabase
    .from("estimates")
    .select("slug, data, expires_at")
    .in("slug", slugs);

  if (error || !data) return [];

  const rows = (data as EstimateRow[]).filter(
    (r) => !r.expires_at || new Date(r.expires_at) >= new Date(),
  );

  // URLパラメータの順番を保つ
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const entries: CompareEntry[] = [];
  slugs.forEach((slug) => {
    const row = bySlug.get(slug);
    if (!row?.data?.result) return;
    entries.push({
      slug: row.slug,
      name:
        row.data.result.extracted?.propertyName?.trim() ||
        row.data.customerInfo?.customerName?.trim() ||
        slug,
      result: row.data.result,
      nearby: row.data.nearby,
      photoUrls: row.data.propertyPhotoUrls ?? [],
    });
  });
  return entries;
}

function NotFound({ lang }: { lang: Language }) {
  const msg = T[lang]?.notFoundCompare ?? T.ja.notFoundCompare;
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-[#dce8d4] p-8 max-w-sm w-full text-center shadow-sm">
        <h1 className="text-base font-semibold text-[#1a2e20]">{msg}</h1>
      </div>
    </div>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sParam = Array.isArray(sp.s) ? sp.s[0] : sp.s;
  const langParam = Array.isArray(sp.lang) ? sp.lang[0] : sp.lang;

  const slugs = parseSlugs(sParam);
  const initialLang = parseLang(langParam);
  const entries = await fetchEstimates(slugs);

  if (entries.length === 0) {
    return <NotFound lang={initialLang} />;
  }

  return <CompareView entries={entries} initialLang={initialLang} />;
}
