"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut({ callbackUrl: "/login" });
      }}
      className="text-[11px] font-medium text-[#5a7a62] hover:text-[#1a2e20] hover:bg-[#eaf3de] border border-[#dce8d4] rounded-full px-2.5 py-0.5 transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
