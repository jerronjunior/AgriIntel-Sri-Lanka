"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Label } from "@/components/ui/kit";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try { await api("/auth/reset-password", { body: { token, new_password: new FormData(e.currentTarget).get("password") }, auth: false, org: false }); setDone(true); }
    catch (e) { setErr((e as ApiError).message); }
  }
  if (!token) return <p className="mt-6 text-rose">This link is missing its token. Request a new reset email.</p>;
  if (done) return <p className="mt-6 text-muted">Password changed. You&apos;ve been signed out everywhere. <Link href="/login" className="text-cyan">Sign in</Link> with your new password.</p>;
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div><Label htmlFor="pw">New password</Label><input id="pw" name="password" type="password" minLength={10} required autoComplete="new-password" className="field" /><p className="mt-1 text-xs text-muted">At least 10 characters with letters and numbers.</p></div>
      {err && <p role="alert" className="text-sm text-rose">{err}</p>}
      <button className="btn btn-primary w-full">Change password</button>
    </form>
  );
}
export default function Reset() { return <><h1 className="text-4xl font-semibold">Choose a new password</h1><Suspense><ResetForm /></Suspense></>; }
