"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { startSession } from "@/lib/session";
import { Label } from "@/components/ui/kit";

function Accept() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const t = await api<{ access_token: string; refresh_token: string }>("/auth/accept-invite", { body: { token, full_name: f.get("name") || null, password: f.get("password") || null }, auth: false, org: false });
      router.push(await startSession(t.access_token, t.refresh_token));
    } catch (e) { setErr((e as ApiError).message); }
  }
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <p className="text-sm text-muted">If you already have an AgriIntel account, leave both fields empty.</p>
      <div><Label htmlFor="name">Your name</Label><input id="name" name="name" className="field" /></div>
      <div><Label htmlFor="pw">Password</Label><input id="pw" name="password" type="password" autoComplete="new-password" className="field" /></div>
      {err && <p role="alert" className="text-sm text-rose">{err}</p>}
      <button className="btn btn-primary w-full">Join organization</button>
    </form>
  );
}
export default function Page() { return <><h1 className="text-4xl font-semibold">Accept your invitation</h1><Suspense><Accept /></Suspense></>; }
