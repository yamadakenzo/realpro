import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SLUG_LENGTH = 8;
const MAX_SLUG_ATTEMPTS = 5;

function generateSlug(): string {
  let s = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return s;
}

function getBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const origin = request.nextUrl.origin;
  if (origin) return origin;
  return "https://realpro-one.vercel.app";
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    if (!data || typeof data !== "object") {
      return Response.json({ error: "見積もりデータが不正です" }, { status: 400 });
    }

    let slug = "";
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const candidate = generateSlug();
      const { error } = await supabase
        .from("estimates")
        .insert({ slug: candidate, data });
      if (!error) {
        slug = candidate;
        break;
      }
      lastError = error;
      // 23505 = unique_violation → 再試行
      if (error.code !== "23505") break;
    }

    if (!slug) {
      console.error("[/api/estimates] insert failed", lastError);
      return Response.json({ error: "見積もりの保存に失敗しました" }, { status: 500 });
    }

    const url = `${getBaseUrl(request)}/estimate/${slug}`;
    return Response.json({ url, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラーが発生しました";
    console.error("[/api/estimates]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
