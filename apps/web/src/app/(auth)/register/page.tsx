"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { startSession } from "@/lib/session";
import { Label } from "@/components/ui/kit";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { ArrowRight, Building2, Lock, Mail, User, Loader2, Sparkles, ShieldCheck, AtSign } from "lucide-react";

const schema = z.object({
  full_name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  username: z.string().min(2, "At least 2 characters").optional().or(z.literal("")),
  password: z.string().min(10, "At least 10 characters").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
  organization_name: z.string().min(2, "Enter your organization's name"),
  industry: z.enum(["farm", "insurance", "banking", "agribusiness", "government"]),
  plan_key: z.enum(["farm", "insurance", "banking", "enterprise"]),
});
type F = z.infer<typeof schema>;
const PLAN_FOR: Record<string, F["plan_key"]> = {
  farm: "farm",
  agribusiness: "farm",
  insurance: "insurance",
  banking: "banking",
  government: "enterprise",
};

function RegisterForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { industry: "farm", plan_key: (sp.get("plan") as F["plan_key"]) ?? "farm" },
  });

  const field = (k: keyof F) => errors[k] && <p className="mt-1 text-xs text-rose">{errors[k]?.message}</p>;

  const submit = async (v: F) => {
    setErr(null);
    let sessionData: { access_token: string; refresh_token: string; org_id: string } | null = null;
    let authError: string | null = null;

    try {
      const firebaseTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firebase registration timed out")), 5000)
      );
      const credential = await Promise.race([
        createUserWithEmailAndPassword(firebaseAuth, v.email, v.password),
        firebaseTimeout,
      ]);
      await updateProfile(credential.user, { displayName: v.full_name });
      sessionData = await api<{ access_token: string; refresh_token: string; org_id: string }>("/auth/firebase/register", {
        body: { ...v, id_token: await credential.user.getIdToken() },
        auth: false,
        org: false,
      });
    } catch (fbErr: unknown) {
      authError = (fbErr as Error)?.message || "Firebase registration failed";
    }

    if (!sessionData) {
      try {
        sessionData = await api<{ access_token: string; refresh_token: string; org_id: string }>("/auth/register", {
          body: v,
          auth: false,
          org: false,
        });
      } catch (nativeErr: unknown) {
        setErr((nativeErr as ApiError)?.message || authError || "Failed to create organization");
        return;
      }
    }

    try {
      const target = await startSession(sessionData.access_token, sessionData.refresh_token, sessionData.org_id);
      router.push(target);
    } catch (sessionErr: unknown) {
      setErr((sessionErr as ApiError)?.message || "Failed to start session");
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <Label htmlFor="n">Your Name</Label>
        <div className="relative mt-1">
          <User className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted/70" />
          <input id="n" className="field !pl-10" placeholder="Dr. Samantha Perera" autoComplete="name" {...register("full_name")} />
        </div>
        {field("full_name")}
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="e">Work Email</Label>
        <div className="relative mt-1">
          <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted/70" />
          <input id="e" type="email" placeholder="samantha@agri.lk" autoComplete="email" className="field !pl-10" {...register("email")} />
        </div>
        {field("email")}
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="u">Username (optional, can be used to sign in)</Label>
        <div className="relative mt-1">
          <AtSign className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted/70" />
          <input id="u" className="field !pl-10" placeholder="e.g. samantha01" autoComplete="username" {...register("username")} />
        </div>
        {field("username")}
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="p">Password</Label>
        <div className="relative mt-1">
          <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted/70" />
          <input id="p" type="password" placeholder="At least 10 characters (letters + numbers)" autoComplete="new-password" className="field !pl-10" {...register("password")} />
        </div>
        {field("password")}
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="o">Organization</Label>
        <div className="relative mt-1">
          <Building2 className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted/70" />
          <input id="o" className="field !pl-10" placeholder="Ceylon Agri Ventures Ltd" {...register("organization_name")} />
        </div>
        {field("organization_name")}
      </div>

      <div>
        <Label htmlFor="i">Industry Sector</Label>
        <select
          id="i"
          className="field mt-1 cursor-pointer"
          {...register("industry", { onChange: (e) => setValue("plan_key", PLAN_FOR[e.target.value]) })}
        >
          <option value="farm">Commercial Farm</option>
          <option value="agribusiness">Agribusiness & Export</option>
          <option value="insurance">Agricultural Insurance</option>
          <option value="banking">Agricultural Bank / Finance</option>
          <option value="government">Government / Policy</option>
        </select>
      </div>

      <div>
        <Label htmlFor="pl">Trial Tier</Label>
        <select id="pl" className="field mt-1 cursor-pointer" {...register("plan_key")}>
          <option value="farm">Farm Intelligence</option>
          <option value="insurance">Insurance Intelligence</option>
          <option value="banking">Banking Intelligence</option>
          <option value="enterprise">Enterprise Intelligence</option>
        </select>
      </div>

      {err && (
        <div role="alert" className="sm:col-span-2 rounded-xl border border-rose/30 bg-rose/10 p-3.5 text-xs text-rose shadow-[0_0_15px_rgba(251,113,133,0.15)]">
          {err}
        </div>
      )}

      <button disabled={isSubmitting} className="btn btn-primary sm:col-span-2 !py-3.5 shadow-lg mt-2">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Deploying organization tenant…</span>
          </>
        ) : (
          <>
            <span>Initialize 14-Day Free Trial</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="text-xs text-muted sm:col-span-2 flex items-center gap-1.5 pt-1">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald shrink-0" />
        <span>No credit card required. Includes instant access to 25 districts & NASA satellite telemetry.</span>
      </p>
    </form>
  );
}

export default function Register() {
  return (
    <>
      <div className="mb-4">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald/40 bg-emerald/10 px-3 py-1 text-xs font-semibold text-emerald shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Full Platform Access · 14 Days</span>
        </div>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-snow">Create organization</h1>
        <p className="mt-2 text-sm text-muted">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-cyan transition-colors hover:text-cyan/80 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
      <Suspense fallback={<div className="skeleton h-80 w-full" />}>
        <RegisterForm />
      </Suspense>
    </>
  );
}
