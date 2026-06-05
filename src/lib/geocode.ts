// 住所 → 緯度経度（サーバー専用）。GOOGLE_PLACES_API_KEY を使うのでサーバー側だけで呼ぶこと。
// ※ APIキーは絶対にクライアントへ渡さない。返すのは座標のみ。
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !address) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("language", "ja");
  url.searchParams.set("region", "jp");
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) return null;
    const { lat, lng } = data.results[0].geometry.location;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
