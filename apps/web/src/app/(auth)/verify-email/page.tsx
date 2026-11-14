"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { CheckCircle2, Loader2, AlertTriangle, ArrowRight } from "lucide-react";

function Verify() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "ok" | string>("working");

  useEffect(() => {
    if (!token) {
      setState("This verification link is missing its security token.");
      return;
    }
    api("/auth/verify-email", { body: { token }, auth: false, org: false })
      .then(() => setState("ok"))
      .catch((e: ApiError) => setState(e.message));
  }, [token]);

  if (state === "working") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-cyan/30 bg-cyan/10 p-5 text-sm text-cyan mt-6">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Validating security signature with satellite authentication server…</span>
      </div>
    );
  }

  if (state === "ok") {
    return (
      <div className="rounded-2xl border border-emerald/40 bg-emerald/10 p-6 text-sm text-emerald mt-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-5 w-5" />
          <span>Email Address Confirmed</span>
        </div>
        <p className="mt-2 text-xs text-muted leading-relaxed">
          Your organization account is fully verified. All satellite intelligence features and NASA data feeds are active.
        </p>
        <Link href="/app" className="btn btn-primary mt-5 !py-2.5 !text-xs w-full">
          <span>Enter Dashboard Console</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-rose/30 bg-rose/10 p-5 text-xs text-rose mt-6">
      <div className="flex items-center gap-2 font-semibold mb-1 text-sm">
        <AlertTriangle className="h-4 w-4 text-rose" />
        <span>Verification Error</span>
      </div>
      <p>{state}</p>
      <Link href="/app" className="btn btn-ghost mt-4 !py-2 !text-xs">
        Return to Dashboard
      </Link>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-snow">Email verification</h1>
      <Suspense fallback={<div className="skeleton h-24 w-full mt-4" />}>
        <Verify />
      </Suspense>
    </>
  );
}
