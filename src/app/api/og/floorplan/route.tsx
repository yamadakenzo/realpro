import {
  WIDTH, HEIGHT, GREEN, LIGHT_GREEN, PLACEHOLDER, PANEL_GRAY,
  fetchEstimate, getPhotos, toDataUri, getFacing,
  renderOg, GreenHeader, PropertyNumber,
} from "../_shared";
import { getOrAssignPostNumber } from "../_postnumber";

// 日本語フォントが大きく Edge の容量制限を超えるため Node ランタイムで動かす。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 2枚目：間取り図
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return new Response("slug が必要です（例: /api/og/floorplan?slug=xxxxxxxx）", { status: 400 });
  }

  const row = await fetchEstimate(slug);
  const prop = row?.data?.result?.extracted;
  if (!prop) {
    return new Response("見積もりが見つかりません（slug が正しいか確認してください）", { status: 404 });
  }

  const postNumber = await getOrAssignPostNumber(slug, row.data, searchParams.get("source") || undefined);

  // 間取り図の自動判別は難しいため、当面は「最後の1枚」を間取り図とみなす。
  // 将来ユーザーが指定できるよう ?floorIndex=（0始まり）で上書きできる余地を残す。
  // （さらに先では保存データに floorPlanPhotoIndex を持たせて永続化する案がある）
  const photos = getPhotos(row);
  const idxParam = searchParams.get("floorIndex");
  let floorIndex = photos.length > 0 ? photos.length - 1 : -1;
  if (idxParam !== null) {
    const n = parseInt(idxParam, 10);
    if (!Number.isNaN(n) && n >= 0 && n < photos.length) floorIndex = n;
  }
  const floorUrl = floorIndex >= 0 ? photos[floorIndex] : undefined;
  const floorData = floorUrl ? await toDataUri(floorUrl) : null;

  const facing = getFacing(prop.facilities);
  const specParts: string[] = [];
  if (prop.floorPlan) specParts.push(prop.floorPlan);
  if (prop.area) specParts.push(`${prop.area}㎡`);
  if (facing) specParts.push(facing.en ? `${facing.ja} ${facing.en}` : facing.ja);
  const specLine = specParts.join(" / ");

  return renderOg(
    <div
      style={{
        position: "relative",
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        fontFamily: "Noto Sans JP",
      }}
    >
      <GreenHeader titleJa="間取り" titleEn="Floor plan" />

      {/* 中央：間取り図を薄グレーの角丸パネルに収める */}
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: "56px 64px 40px",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 952,
            height: 760,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: PANEL_GRAY,
            borderRadius: 28,
            padding: 28,
          }}
        >
          {floorData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={floorData}
              style={{ maxWidth: 896, maxHeight: 704, objectFit: "contain", borderRadius: 12 }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 896,
                height: 704,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: PLACEHOLDER,
                borderRadius: 12,
              }}
            >
              <span style={{ fontSize: 30, color: "#9aa3a0" }}>間取り図 No floor plan image</span>
            </div>
          )}
        </div>
      </div>

      {/* 下部：間取り / 面積 / 方位（日英） */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 64,
        }}
      >
        <span style={{ fontSize: 44, fontWeight: 500, color: GREEN }}>{specLine || "—"}</span>
        {prop.propertyName ? (
          <span style={{ fontSize: 28, color: LIGHT_GREEN, marginTop: 8 }}>{prop.propertyName}</span>
        ) : null}
      </div>

      <PropertyNumber value={postNumber} />
    </div>,
  );
}
