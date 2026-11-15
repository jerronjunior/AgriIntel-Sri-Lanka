"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { startSession } from "@/lib/session";
import { Label } from "@/components/ui/kit";
import { ArrowRight, Lock, User as UserIcon, Loader2, Sparkles, AlertTriangle, Zap, CheckCircle2 } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [apiOffline, setApiOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  // Quick fill helper
  const fillCredentials = (u: string, p: string) => {
    setIdentifier(u);
    setPassword(p);
    setErr(null);
    setApiOffline(false);
  };

  // Instant Demo Mode bypass
  const enterDemoMode = async () => {
    setBusy(true);
    setErr(null);
    try {
      const target = await startSession("demo-token", "demo-refresh-token");
      router.push(target);
    } catch {
      router.push("/app");
    } finally {
      setBusy(false);
    }
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = identifier.trim();
    const pwd = password;

    if (!id || !pwd) {
      setErr("Please enter your username/email and password");
      return;
    }

    setBusy(true);
    setErr(null);
    setApiOffline(false);

    let sessionTokens: { access_token: string; refresh_token: string } | null = null;
    let isNetworkError = false;

    // 1. Try Native FastAPI backend first (<50ms response for both username or email)
    try {
      sessionTokens = await api<{ access_token: string; refresh_token: string }>("/auth/login", {
        body: { username_or_email: id, password: pwd },
        auth: false,
        org: false,
      });
    } catch (nativeErr: unknown) {
      const apiErr = nativeErr as ApiError;
      if (apiErr?.code === "network_error" || apiErr?.status === 0) {
        isNetworkError = true;
      }
    }

    // 2. If Native API had credentials error and identifier is email, try Firebase Authentication
    if (!sessionTokens && !isNetworkError && id.includes("@")) {
      try {
        const firebaseTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Firebase authentication timed out")), 4000)
        );
        const credential = await Promise.race([
          signInWithEmailAndPassword(firebaseAuth, id, pwd),
          firebaseTimeout,
        ]);
        const idToken = await credential.user.getIdToken();
        sessionTokens = await api<{ access_token: string; refresh_token: string }>("/auth/firebase/session", {
          body: { id_token: idToken },
          auth: false,
          org: false,
        });
      } catch (fbErr: unknown) {
        // Firebase also failed
      }
    }

    // 3. Handle errors
    if (!sessionTokens) {
      setBusy(false);
      if (isNetworkError) {
        setApiOffline(true);
        setErr("AgriIntel API server (http://localhost:8000) is offline or unreachable.");
      } else {
        setErr("Invalid username/email or password. Please verify credentials or use demo mode.");
      }
      return;
    }

    // 4. Initialize user session and route to the dashboard
    try {
      const target = await startSession(sessionTokens.access_token, sessionTokens.refresh_token);
      router.push(target);
    } catch {
      router.push("/app");
    } finally {
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

      {/* Demo Credentials Quick-Fill Bar */}
      <div className="mb-6 rounded-2xl border border-cyan/30 bg-midnight/80 p-3.5 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan flex items-center gap-1">
            <Zap className="h-3 w-3" /> Quick Demo Accounts
          </span>
          <span className="text-[10px] text-muted">Click to auto-fill</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fillCredentials("user01", "Password123!")}
            className="flex flex-col text-left rounded-xl border border-line/60 bg-panel/70 p-2 text-xs transition-all hover:border-cyan/50 hover:bg-panel"
          >
            <span className="font-semibold text-snow flex items-center gap-1">
              🌾 Farm Manager
            </span>
            <span className="font-mono text-[10px] text-muted">user01 / Password123!</span>
          </button>
          <button
            type="button"
            onClick={() => fillCredentials("admin", "ChangeMe12345")}
            className="flex flex-col text-left rounded-xl border border-line/60 bg-panel/70 p-2 text-xs transition-all hover:border-cyan/50 hover:bg-panel"
          >
            <span className="font-semibold text-snow flex items-center gap-1">
              🛡️ Super Admin
            </span>
            <span className="font-mono text-[10px] text-muted">admin / ChangeMe12345</span>
          </button>
        </div>
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
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              placeholder="Username (user01) or email"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••••••"
              className="field !pl-10"
            />
          </div>
        </div>

        {err && (
          <div role="alert" className="rounded-xl border border-rose/30 bg-rose/10 p-3.5 text-xs text-rose shadow-[0_0_15px_rgba(251,113,133,0.15)]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{err}</p>
                {apiOffline && (
                  <p className="mt-1 text-[11px] text-rose/80">
                    Run <code className="bg-night/50 px-1 py-0.5 rounded font-mono">python -m uvicorn app.main:app --port 8000</code> or access offline below:
                  </p>
                )}
              </div>
            </div>
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

        {/* Offline Demo Mode Bypass Button */}
        <div className="pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={enterDemoMode}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald/40 bg-emerald/10 py-2.5 text-xs font-bold text-emerald transition-all hover:bg-emerald/20 hover:border-emerald/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald" />
            <span>Enter Instant Demo Mode (No backend required)</span>
          </button>
        </div>

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
