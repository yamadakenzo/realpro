import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabase";

// 1物件（estimates の1行）に対する操作。認証必須ルート（/api/estimates 配下）。
// - GET   : /instagram の写真ピッカー用に、写真URL一覧と保存済みの表紙index・間取りindexを返す
// - PATCH : 表紙に使う写真（data.coverPhotoIndex）／間取り図に使う写真（data.floorPlanIndex）の index を保存（service_role の UPDATE）
// - DELETE: 論理削除（expires_at を過去にして一覧・共有から隠す。GRANT DELETE 不要）
export const dynamic = "force-dynamic";

type EstimateData = {
  result?: { extracted?: { propertyName?: string } };
  propertyPhotoUrls?: unknown;
  floorPlanIndex?: unknown;
  coverPhotoIndex?: unknown;
  igPost?: { number?: string };
  [k: string]: unknown;
};

function getPhotos(data: EstimateData): string[] {
  const arr = data.propertyPhotoUrls;
  return Array.isArray(arr) ? arr.filter((u): u is string => typeof u === "string" && u.length > 0) : [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = getSupabaseAdmin() ?? supabase;
  const { data: row, error } = await client
    .from("estimates")
    .select("slug, data")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !row) {
    return Response.json({ error: "物件が見つかりません" }, { status: 404 });
  }
  const data = (row.data ?? {}) as EstimateData;
  const photos = getPhotos(data);
  const floorIndex =
    typeof data.floorPlanIndex === "number" && data.floorPlanIndex >= 0 && data.floorPlanIndex < photos.length
      ? data.floorPlanIndex
      : null;
  const coverIndex =
    typeof data.coverPhotoIndex === "number" && data.coverPhotoIndex >= 0 && data.coverPhotoIndex < photos.length
      ? data.coverPhotoIndex
      : null;
  return Response.json({
    slug,
    photos,
    floorIndex,
    coverIndex,
    propertyName: data.result?.extracted?.propertyName ?? "",
    number: data.igPost?.number ?? "",
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { floorIndex?: unknown; coverIndex?: unknown };
    // floorIndex / coverIndex のどちらか（または両方）を保存できる。
    const wantFloor = body.floorIndex !== undefined && body.floorIndex !== null;
    const wantCover = body.coverIndex !== undefined && body.coverIndex !== null;
    if (!wantFloor && !wantCover) {
      return Response.json({ error: "floorIndex か coverIndex が必要です" }, { status: 400 });
    }
    const floorIndex = wantFloor ? Number(body.floorIndex) : null;
    const coverIndex = wantCover ? Number(body.coverIndex) : null;
    if (wantFloor && (!Number.isInteger(floorIndex as number) || (floorIndex as number) < 0)) {
      return Response.json({ error: "floorIndex が不正です" }, { status: 400 });
    }
    if (wantCover && (!Number.isInteger(coverIndex as number) || (coverIndex as number) < 0)) {
      return Response.json({ error: "coverIndex が不正です" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) return Response.json({ error: "サーバー設定エラー" }, { status: 500 });

    const { data: row, error } = await admin.from("estimates").select("data").eq("slug", slug).maybeSingle();
    if (error || !row) return Response.json({ error: "物件が見つかりません" }, { status: 404 });

    const data = (row.data ?? {}) as EstimateData;
    const photos = getPhotos(data);
    if (wantFloor && (floorIndex as number) >= photos.length) {
      return Response.json({ error: "写真の範囲外です" }, { status: 400 });
    }
    if (wantCover && (coverIndex as number) >= photos.length) {
      return Response.json({ error: "写真の範囲外です" }, { status: 400 });
    }

    const newData: EstimateData = { ...data };
    if (wantFloor) newData.floorPlanIndex = floorIndex as number;
    if (wantCover) newData.coverPhotoIndex = coverIndex as number;
    const { error: upErr } = await admin.from("estimates").update({ data: newData }).eq("slug", slug);
    if (upErr) {
      console.error("[/api/estimates/[slug] PATCH]", upErr);
      return Response.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return Response.json({ slug, floorIndex, coverIndex });
  } catch (e) {
    console.error("[/api/estimates/[slug] PATCH]", e);
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const admin = getSupabaseAdmin();
    if (!admin) return Response.json({ error: "サーバー設定エラー" }, { status: 500 });

    // 論理削除：expires_at を過去にする。一覧（GET /api/estimates）・共有ページ・og は期限切れを除外するため隠れる。
    // 物理削除には GRANT DELETE が必要だが、ここでは UPDATE のみで実現（行は残る＝復活も可能）。
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin.from("estimates").update({ expires_at: past }).eq("slug", slug);
    if (error) {
      console.error("[/api/estimates/[slug] DELETE]", error);
      return Response.json({ error: "削除に失敗しました" }, { status: 500 });
    }
    return Response.json({ slug, deleted: true });
  } catch (e) {
    console.error("[/api/estimates/[slug] DELETE]", e);
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
