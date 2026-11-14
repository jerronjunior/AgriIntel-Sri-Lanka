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

const schema = z.object({
  full_name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(10, "At least 10 characters").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a number"),
  organization_name: z.string().min(2, "Enter your organization's name"),
  industry: z.enum(["farm", "insurance", "banking", "agribusiness", "government"]),
  plan_key: z.enum(["farm", "insurance", "banking", "enterprise"]),
});
type F = z.infer<typeof schema>;
const PLAN_FOR: Record<string, F["plan_key"]> = { farm: "farm", agribusiness: "farm", insurance: "insurance", banking: "banking", government: "enterprise" };

function RegisterForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema), defaultValues: { industry: "farm", plan_key: (sp.get("plan") as F["plan_key"]) ?? "farm" },
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
    <form onSubmit={handleSubmit(submit)} className="mt-8 grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><Label htmlFor="n">Your name</Label><input id="n" className="field" autoComplete="name" {...register("full_name")} />{field("full_name")}</div>
      <div className="sm:col-span-2"><Label htmlFor="e">Work email</Label><input id="e" type="email" autoComplete="email" className="field" {...register("email")} />{field("email")}</div>
      <div className="sm:col-span-2"><Label htmlFor="p">Password</Label><input id="p" type="password" autoComplete="new-password" className="field" {...register("password")} />{field("password")}</div>
      <div className="sm:col-span-2"><Label htmlFor="o">Organization</Label><input id="o" className="field" {...register("organization_name")} />{field("organization_name")}</div>
      <div><Label htmlFor="i">Industry</Label>
        <select id="i" className="field" {...register("industry", { onChange: (e) => setValue("plan_key", PLAN_FOR[e.target.value]) })}>
          <option value="farm">Commercial farm</option><option value="agribusiness">Agribusiness</option><option value="insurance">Insurance</option><option value="banking">Agricultural bank</option><option value="government">Government</option>
        </select></div>
      <div><Label htmlFor="pl">Trial plan</Label>
        <select id="pl" className="field" {...register("plan_key")}><option value="farm">Farm Intelligence</option><option value="insurance">Insurance Intelligence</option><option value="banking">Banking Intelligence</option><option value="enterprise">Enterprise Intelligence</option></select></div>
      {err && <p role="alert" className="text-sm text-rose sm:col-span-2">{err}</p>}
      <button disabled={isSubmitting} className="btn btn-primary sm:col-span-2">{isSubmitting ? "Creating…" : "Create organization"}</button>
      <p className="text-xs text-muted sm:col-span-2">You become the organization admin and can invite your team afterwards. We&apos;ll email you a link to verify your address.</p>
    </form>
  );
}

export default function Register() {
  return (
    <>
      <h1 className="text-4xl font-semibold">Start your 14-day trial</h1>
      <p className="mt-2 text-muted">Already have an account? <Link href="/login" className="text-cyan hover:underline">Sign in</Link></p>
      <Suspense><RegisterForm /></Suspense>
    </>
  );
}
