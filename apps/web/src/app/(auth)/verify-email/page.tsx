"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

function Verify() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "ok" | string>("working");
  useEffect(() => {
    if (!token) { setState("This link is missing its token."); return; }
    api("/auth/verify-email", { body: { token }, auth: false, org: false }).then(() => setState("ok")).catch((e: ApiError) => setState(e.message));
  }, [token]);
  if (state === "working") return <p className="mt-6 text-muted">Verifying…</p>;
  if (state === "ok") return <p className="mt-6">Your email is verified. <Link href="/app" className="text-cyan">Open your dashboard</Link></p>;
  return <p className="mt-6 text-rose">{state} You can request a new link from your dashboard.</p>;
}
export default function Page() { return <><h1 className="text-4xl font-semibold">Email verification</h1><Suspense><Verify /></Suspense></>; }
