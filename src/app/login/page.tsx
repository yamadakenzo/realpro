"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError("メールアドレスまたはパスワードが正しくありません");
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError("ログインに失敗しました。時間をおいて再度お試しください");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-medium text-[#1a2e20] mb-1.5"
        >
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 bg-white border border-[#b8d898] rounded-lg text-sm text-[#1a2e20] placeholder:text-[#90b098] focus:outline-none focus:ring-2 focus:ring-[#2d5e3a] focus:border-transparent"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-medium text-[#1a2e20] mb-1.5"
        >
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2.5 bg-white border border-[#b8d898] rounded-lg text-sm text-[#1a2e20] focus:outline-none focus:ring-2 focus:ring-[#2d5e3a] focus:border-transparent"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 bg-[#2d5e3a] text-white text-sm font-medium rounded-lg hover:bg-[#1a2e20] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f7f9f4] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-[#dce8d4] rounded-2xl shadow-sm p-7 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#2d5e3a] rounded-[10px] flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-medium text-[#1a2e20] tracking-tight">
              物件費用見積書
            </h1>
            <p className="text-xs text-[#7a9e82] mt-0.5">ログイン</p>
          </div>
        </div>

        <Suspense fallback={<div className="h-[260px]" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
