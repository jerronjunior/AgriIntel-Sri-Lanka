"use client";
import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Label } from "@/components/ui/kit";

export default function Forgot() {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try { const d = await api<{ message: string }>("/auth/forgot-password", { body: { email: new FormData(e.currentTarget).get("email") }, auth: false, org: false }); setMsg(d.message); }
    catch (e) { setErr((e as ApiError).message); }
  }
  return (
    <>
      <h1 className="text-4xl font-semibold">Reset your password</h1>
      {msg ? <p className="mt-6 text-muted">{msg}</p> : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div><Label htmlFor="email">Account email</Label><input id="email" name="email" type="email" required className="field" /></div>
          {err && <p role="alert" className="text-sm text-rose">{err}</p>}
          <button className="btn btn-primary w-full">Email me a reset link</button>
        </form>)}
      <Link href="/login" className="mt-6 block text-sm text-muted hover:text-ink">Back to sign in</Link>
    </>
  );
}
