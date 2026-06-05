import { NextRequest } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

// 物件位置の静的地図を返すサーバールート。
// ★最重要：GOOGLE_PLACES_API_KEY はこのサーバー内だけで使い、絶対にクライアント（HTML）に出さない。
//   呼び出し側は <img src="/api/staticmap?lat=..&lng=.."> または ?address=.. を使う。キーはURLに含めない。
//
// 受け付けるパラメータ：
//   - lat, lng（座標が手元にあれば優先。再ジオコーディング不要）
//   - address（座標が無い場合のフォールバック。サーバー側で住所→座標に変換）
// 座標が取れない／キーが無い場合は 404（呼び出し側で地図セクションを出さない）。

function parseCoord(v: string | null): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return new Response("Map unavailable", { status: 404 });

  const sp = request.nextUrl.searchParams;

  let lat = parseCoord(sp.get("lat"));
  let lng = parseCoord(sp.get("lng"));

  // 座標が無ければ住所からジオコーディング（フォールバック）
  if (lat == null || lng == null) {
    const address = sp.get("address")?.trim();
    if (!address) return new Response("Missing location", { status: 404 });
    const loc = await geocodeAddress(address);
    if (!loc) return new Response("Geocode failed", { status: 404 });
    lat = loc.lat;
    lng = loc.lng;
  }

  // 範囲チェック（不正値で外部APIを叩かない）
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return new Response("Invalid location", { status: 404 });
  }

  const lang = sp.get("lang") || "ja";
  const center = `${lat},${lng}`;

  const mapUrl = new URL("https://maps.googleapis.com/maps/api/staticmap");
  mapUrl.searchParams.set("center", center);
  mapUrl.searchParams.set("zoom", "16");
  mapUrl.searchParams.set("size", "600x300");
  mapUrl.searchParams.set("scale", "2"); // 高解像度（PDF・Retina向け）
  mapUrl.searchParams.set("language", lang);
  mapUrl.searchParams.set("region", "jp");
  mapUrl.searchParams.set("markers", `color:0x2d5e3a|${center}`);
  mapUrl.searchParams.set("key", key);

  try {
    const res = await fetch(mapUrl.toString());
    if (!res.ok) return new Response("Map fetch failed", { status: 502 });
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // 同じ座標の地図は変わらないので長めにキャッシュ（再呼び出し・APIコストを抑える）
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch {
    return new Response("Map fetch error", { status: 502 });
  }
}
