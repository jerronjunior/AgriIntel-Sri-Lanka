"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { startSession } from "@/lib/session";
import { Label } from "@/components/ui/kit";
import { ArrowRight, Lock, User as UserIcon, Loader2, Sparkles } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const identifier = String(f.get("identifier") || f.get("email") || "").trim();
    const password = String(f.get("password"));

    setBusy(true);
    setErr(null);

    let sessionTokens: { access_token: string; refresh_token: string } | null = null;
    let authError: string | null = null;

    // 1. If identifier is an email, try Firebase Authentication first
    if (identifier.includes("@")) {
      try {
        const firebaseTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Firebase authentication timed out")), 5000)
        );
        const credential = await Promise.race([
          signInWithEmailAndPassword(firebaseAuth, identifier, password),
          firebaseTimeout,
        ]);
        const idToken = await credential.user.getIdToken();
        sessionTokens = await api<{ access_token: string; refresh_token: string }>("/auth/firebase/session", {
          body: { id_token: idToken },
          auth: false,
          org: false,
        });
      } catch (fbErr: unknown) {
        authError = (fbErr as Error)?.message || "Firebase sign in failed";
      }
    }

    // 2. If not authenticated yet (or if username was entered instead of email), log in via native API
    if (!sessionTokens) {
      try {
        sessionTokens = await api<{ access_token: string; refresh_token: string }>("/auth/login", {
          body: { username_or_email: identifier, password },
          auth: false,
          org: false,
        });
      } catch (nativeErr: unknown) {
        setErr((nativeErr as ApiError)?.message || authError || "Invalid username/email or password");
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
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1 text-xs font-semibold text-cyan shadow-[0_0_15px_rgba(34,211,238,0.2)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Agricultural Intelligence Terminal</span>
        </div>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-snow">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          New to AgriIntel?{" "}
          <Link href="/register" className="font-semibold text-cyan transition-colors hover:text-cyan/80 hover:underline">
            Create an organization
          </Link>
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label htmlFor="identifier">Username or Email</Label>
          <div className="relative mt-1">
            <UserIcon className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted/70" />
            <input
              id="identifier"
              name="identifier"
              type="text"
              required
              autoComplete="username"
              placeholder="Username (e.g. user01) or email"
              className="field !pl-10"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1">
            <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted/70" />
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••••"
              className="field !pl-10"
            />
          </div>
        </div>

        {err && (
          <div role="alert" className="rounded-xl border border-rose/30 bg-rose/10 p-3.5 text-xs text-rose shadow-[0_0_15px_rgba(251,113,133,0.15)]">
            {err}
          </div>
        )}

        <button disabled={busy} className="btn btn-primary w-full !py-3.5 shadow-lg">
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Authenticating telemetry…</span>
            </>
          ) : (
            <>
              <span>Sign in to console</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <div className="flex items-center justify-between pt-2">
          <Link href="/forgot-password" className="text-xs text-muted transition-colors hover:text-cyan">
            Forgot your password?
          </Link>
          <span className="text-[11px] font-mono text-muted/60">SSL · 256-bit AES</span>
        </div>
      </form>
    </>
  );
}
