"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { startSession } from "@/lib/session";
import { Label } from "@/components/ui/kit";

export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));

    setBusy(true);
    setErr(null);

    let sessionTokens: { access_token: string; refresh_token: string } | null = null;
    let authError: string | null = null;

    // 1. Try Firebase Authentication with a timeout so it never hangs indefinitely
    try {
      const firebaseTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firebase authentication timed out")), 5000)
      );
      const credential = await Promise.race([
        signInWithEmailAndPassword(firebaseAuth, email, password),
        firebaseTimeout,
      ]);
      const idToken = await credential.user.getIdToken();
      sessionTokens = await api<{ access_token: string; refresh_token: string }>("/auth/firebase/session", {
        body: { id_token: idToken },
        auth: false,
        org: false,
      });
    } catch (fbErr: unknown) {
      // If Firebase auth failed or timed out, we fall back to native AgriIntel login
      authError = (fbErr as Error)?.message || "Firebase sign in failed";
    }

    // 2. If Firebase did not authenticate (or timed out / user registered natively), try native API login
    if (!sessionTokens) {
      try {
        sessionTokens = await api<{ access_token: string; refresh_token: string }>("/auth/login", {
          body: { email, password },
          auth: false,
          org: false,
        });
      } catch (nativeErr: unknown) {
        setErr((nativeErr as ApiError)?.message || authError || "Invalid email or password");
        setBusy(false);
        return;
      }
    }

    // 3. Initialize user session and route to the dashboard
    try {
      const target = await startSession(sessionTokens.access_token, sessionTokens.refresh_token);
      router.push(target);
    } catch (sessionErr: unknown) {
      setErr((sessionErr as ApiError)?.message || "Failed to start session");
      setBusy(false);
    }
  }
  return (
    <>
      <h1 className="text-4xl font-semibold">Sign in</h1>
      <p className="mt-2 text-muted">New to AgriIntel? <Link href="/register" className="text-cyan hover:underline">Create an organization</Link></p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div><Label htmlFor="email">Email</Label><input id="email" name="email" type="email" required autoComplete="email" className="field" /></div>
        <div><Label htmlFor="password">Password</Label><input id="password" name="password" type="password" required autoComplete="current-password" className="field" /></div>
        {err && <p role="alert" className="text-sm text-rose">{err}</p>}
        <button disabled={busy} className="btn btn-primary w-full">{busy ? "Signing in…" : "Sign in"}</button>
        <Link href="/forgot-password" className="block text-sm text-muted hover:text-ink">Forgot your password?</Link>
      </form>
    </>
  );
}
