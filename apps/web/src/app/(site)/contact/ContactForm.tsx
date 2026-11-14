"use client";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Label } from "@/components/ui/kit";

const schema = z.object({
  kind: z.enum(["contact", "demo", "subscription"]),
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  organization: z.string().max(200).optional(),
  industry: z.string().optional(),
  plan_key: z.string().optional(),
  message: z.string().max(5000).optional(),
  website: z.string().max(0).optional(),
});
type F = z.infer<typeof schema>;

export default function ContactForm() {
  const sp = useSearchParams();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { kind: (sp.get("kind") as F["kind"]) ?? "contact", plan_key: sp.get("plan") ?? "" },
  });
  const submit = async (v: F) => {
    setErr(null);
    try { await api("/contact", { body: { ...v, plan_key: v.plan_key || null, website: v.website ?? "" }, auth: false, org: false }); setDone(true); }
    catch (e) { setErr((e as ApiError).message); }
  };
  if (done) return <div className="panel p-8"><h2 className="text-2xl font-semibold">Request sent</h2><p className="mt-2 text-muted">We&apos;ll reply to you by email.</p></div>;
  return (
    <form onSubmit={handleSubmit(submit)} className="panel grid gap-4 p-6 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><Label htmlFor="kind">What do you need?</Label>
        <select id="kind" className="field" {...register("kind")}><option value="demo">An enterprise demo</option><option value="subscription">A plan quote</option><option value="contact">Something else</option></select></div>
      <div><Label htmlFor="name">Name</Label><input id="name" className="field" {...register("name")} />{errors.name && <p className="mt-1 text-xs text-rose">{errors.name.message}</p>}</div>
      <div><Label htmlFor="email">Work email</Label><input id="email" type="email" className="field" {...register("email")} />{errors.email && <p className="mt-1 text-xs text-rose">{errors.email.message}</p>}</div>
      <div><Label htmlFor="org">Organization</Label><input id="org" className="field" {...register("organization")} /></div>
      <div><Label htmlFor="industry">Industry</Label>
        <select id="industry" className="field" {...register("industry")}><option value="">Choose one</option><option value="farm">Commercial farm</option><option value="banking">Agricultural bank</option><option value="insurance">Insurance</option><option value="agribusiness">Agribusiness</option><option value="government">Government</option></select></div>
      <div className="sm:col-span-2"><Label htmlFor="msg">Message</Label><textarea id="msg" rows={5} className="field" {...register("message")} /></div>
      <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden {...register("website")} />
      {err && <p role="alert" className="text-sm text-rose sm:col-span-2">{err}</p>}
      <button disabled={isSubmitting} className="btn btn-primary sm:col-span-2">{isSubmitting ? "Sending…" : "Send request"}</button>
    </form>
  );
}
