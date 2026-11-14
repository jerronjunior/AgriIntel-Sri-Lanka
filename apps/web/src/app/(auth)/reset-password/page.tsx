"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Label } from "@/components/ui/kit";
import { Lock, CheckCircle2, ArrowRight } from "lucide-react";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await api("/auth/reset-password", {
        body: { token, new_password: new FormData(e.currentTarget).get("password") },
        auth: false,
        org: false,
      });
      setDone(true);
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-rose/30 bg-rose/10 p-4 text-xs text-rose mt-4">
        This link is missing its security token. Please request a new password reset email.
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald/40 bg-emerald/10 p-6 text-sm text-emerald mt-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-5 w-5" />
          <span>Password Successfully Updated</span>
        </div>
        <p className="mt-2 text-xs text-muted leading-relaxed">
          Your credentials have been updated and existing sessions revoked.
        </p>
        <Link href="/login" className="btn btn-primary mt-4 !py-2.5 !text-xs w-full">
          <span>Sign in with new password</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div>
        <Label htmlFor="pw">New Password</Label>
        <div className="relative mt-1">
          <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted/70" />
          <input
            id="pw"
            name="password"
            type="password"
            minLength={10}
            required
            autoComplete="new-password"
            placeholder="At least 10 characters (letters + numbers)"
            className="field !pl-10"
          />
        </div>
      </div>

      {err && (
        <div role="alert" className="rounded-xl border border-rose/30 bg-rose/10 p-3 text-xs text-rose">
          {err}
        </div>
      )}

      <button disabled={loading} className="btn btn-primary w-full !py-3.5 shadow-lg">
        {loading ? "Updating credentials…" : "Confirm new password"}
      </button>
    </form>
  );
}

export default function Reset() {
  return (
    <>
      <div className="mb-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-snow">Choose new password</h1>
        <p className="mt-2 text-sm text-muted">Set a secure password to regain access to your console.</p>
      </div>
      <Suspense fallback={<div className="skeleton h-32 w-full" />}>
        <ResetForm />
      </Suspense>
    </>
  );
}
