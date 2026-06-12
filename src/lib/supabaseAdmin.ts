import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// サーバー専用の Supabase クライアント（サービスロールキー使用＝RLSをバイパス）。
// 投稿番号の採番のように「保存済み見積もりを更新する」用途で使う。
// ⚠️ サービスロールキーは絶対にクライアントへ露出させない。このモジュールはサーバー側ルートからのみ import すること。
// （NEXT_PUBLIC_ ではない env を参照するのでクライアントバンドルには含まれない）
//
// import 時に throw すると env 未設定の環境でビルドが落ちうるため、遅延生成（必要時のみ作成・無ければ null）。
let cached: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached =
    url && serviceKey
      ? createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  return cached;
}
