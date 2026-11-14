"use client";
import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Label } from "@/components/ui/kit";
import { Mail, ArrowLeft, Send, CheckCircle2 } from "lucide-react";

export default function Forgot() {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const d = await api<{ message: string }>("/auth/forgot-password", {
        body: { email: new FormData(e.currentTarget).get("email") },
        auth: false,
        org: false,
      });
      setMsg(d.message);
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-snow">Reset password</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your registered work email to receive password recovery instructions.
        </p>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-emerald/40 bg-emerald/10 p-5 text-sm text-emerald shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            <span>Instructions Dispatched</span>
          </div>
          <p className="mt-2 text-xs text-muted leading-relaxed">{msg}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <Label htmlFor="email">Account Email</Label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted/70" />
              <input id="email" name="email" type="email" required placeholder="name@company.com" className="field !pl-10" />
            </div>
          </div>

          {err && (
            <div role="alert" className="rounded-xl border border-rose/30 bg-rose/10 p-3 text-xs text-rose">
              {err}
            </div>
          )}

          <button disabled={loading} className="btn btn-primary w-full !py-3.5 shadow-lg">
            <span>{loading ? "Dispatching reset link…" : "Email me a reset link"}</span>
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}

      <div className="mt-6 border-t border-line/50 pt-4">
        <Link href="/login" className="inline-flex items-center gap-2 text-xs font-semibold text-muted transition-colors hover:text-cyan">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to sign in</span>
        </Link>
      </div>
    </>
  );
}
