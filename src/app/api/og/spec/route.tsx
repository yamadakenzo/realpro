import {
  WIDTH, HEIGHT, GREEN, LIGHT_GREEN,
  fetchEstimate, getFacing, featuresBilingual, yen,
  renderOg, GreenHeader, PropertyNumber,
} from "../_shared";
import { getOrAssignPostNumber } from "../_postnumber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1行分（日本語ラベル＋小さい英語ラベル＋値、下に薄い区切り線）
function SpecRow({
  labelJa, labelEn, value, last,
}: {
  labelJa: string; labelEn: string; value: string; last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        padding: "20px 0",
        borderBottom: last ? "none" : "1px solid #e5e9e2",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 34, fontWeight: 500, color: "#1a2e20" }}>{labelJa}</span>
        <span style={{ fontSize: 20, color: "#9bb3a3", marginTop: 2 }}>{labelEn}</span>
      </div>
      <span style={{ fontSize: 34, color: "#1a2e20", textAlign: "right", maxWidth: 620 }}>{value}</span>
    </div>
  );
}

// 3枚目：スペック一覧
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return new Response("slug が必要です（例: /api/og/spec?slug=xxxxxxxx）", { status: 400 });
  }

  const row = await fetchEstimate(slug);
  const prop = row?.data?.result?.extracted;
  if (!prop) {
    return new Response("見積もりが見つかりません（slug が正しいか確認してください）", { status: 404 });
  }

  const postNumber = await getOrAssignPostNumber(slug, row.data, searchParams.get("source") || undefined);

  const rentTotal = (prop.rent ?? 0) + (prop.managementFee ?? 0);
  const layout = [prop.floorPlan, prop.area ? `${prop.area}㎡` : ""].filter(Boolean).join(" / ") || "—";
  const station = prop.nearestStation
    ? prop.stationWalkMinutes
      ? `${prop.nearestStation} 徒歩${prop.stationWalkMinutes}分`
      : prop.nearestStation
    : "—";
  const built = prop.buildingAge || "—";
  const facing = getFacing(prop.facilities);
  const noDepositKey = (prop.deposit ?? 0) === 0 && (prop.keyMoney ?? 0) === 0;
  const moveIn = noDepositKey
    ? "敷金・礼金なし"
    : `敷金 ${yen(prop.deposit)} ・ 礼金 ${yen(prop.keyMoney)}`;

  const { jaText, enText } = featuresBilingual(prop.facilities);

  // 向きは facilities にあるときだけ行を出す
  const rows: { labelJa: string; labelEn: string; value: string }[] = [
    { labelJa: "賃料", labelEn: "Rent", value: `${yen(rentTotal)}（管理費込）` },
    { labelJa: "間取り", labelEn: "Layout", value: layout },
    { labelJa: "最寄り駅", labelEn: "Station", value: station },
    { labelJa: "築年", labelEn: "Built", value: built },
  ];
  if (facing) {
    rows.push({ labelJa: "向き", labelEn: "Facing", value: facing.en ? `${facing.ja} ${facing.en}` : facing.ja });
  }
  rows.push({ labelJa: "初期費用", labelEn: "Move-in", value: moveIn });

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
      <GreenHeader titleJa="お部屋の詳細" titleEn="Room details" />

      <div style={{ display: "flex", flexDirection: "column", padding: "40px 64px 0" }}>
        {rows.map((r, i) => (
          <SpecRow
            key={r.labelJa}
            labelJa={r.labelJa}
            labelEn={r.labelEn}
            value={r.value}
            last={i === rows.length - 1}
          />
        ))}
      </div>

      {/* 設備 Features */}
      {jaText ? (
        <div style={{ display: "flex", flexDirection: "column", padding: "36px 64px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <span style={{ fontSize: 30, fontWeight: 500, color: GREEN }}>設備</span>
            <span style={{ fontSize: 20, color: "#9bb3a3", marginLeft: 10, marginBottom: 3 }}>Features</span>
          </div>
          <div style={{ display: "flex", marginTop: 14 }}>
            <span style={{ fontSize: 30, color: "#1a2e20", lineHeight: 1.5 }}>{jaText}</span>
          </div>
          {enText ? (
            <div style={{ display: "flex", marginTop: 8 }}>
              <span style={{ fontSize: 22, color: LIGHT_GREEN, lineHeight: 1.5 }}>{enText}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <PropertyNumber value={postNumber} />
    </div>,
  );
}
