"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, Panel, Skeleton, Stat } from "@/components/ui/kit";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import type { Plan } from "@/lib/types";

type Stats = { organizations: number; active_users: number; farms: number; simulations: number; subscriptions: { plan: string; status: string; count: number }[];
  data_sources: { key: string; status: string; last_success_at: string | null; last_error: string | null }[]; jobs: Record<string, number>; models: { name: string; version: string; status: string }[]; open_contact_requests: number };
type Org = { id: string; name: string; industry: string; status: string; members: number; plan: string | null; subscription_status: string | null };

function PlanEditor({ p, onSaved }: { p: Plan; onSaved: (m: string) => void }) {
  const [amount, setAmount] = useState(p.price_amount?.toString() ?? "");
  const [cur, setCur] = useState(p.price_currency ?? "LKR");
  const [period, setPeriod] = useState(p.billing_period ?? "monthly");
  const save = async () => {
    try { await api(`/admin/plans/${p.key}`, { method: "PATCH", org: false, body: { price_amount: amount === "" ? null : +amount, price_currency: amount === "" ? null : cur, billing_period: amount === "" ? null : period } }); onSaved(`${p.name} pricing saved.`); }
    catch (e) { onSaved((e as ApiError).message); }
  };
  return (
    <tr className="border-t border-line"><td className="py-2 font-medium">{p.name}</td>
      <td><input aria-label="Price" type="number" min={0} placeholder="On request" className="field !w-32 !py-1" value={amount} onChange={(e) => setAmount(e.target.value)} /></td>
      <td><input aria-label="Currency" maxLength={3} className="field !w-20 !py-1 uppercase" value={cur} onChange={(e) => setCur(e.target.value.toUpperCase())} /></td>
      <td><select aria-label="Billing period" className="field !w-32 !py-1" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="monthly">monthly</option><option value="annual">annual</option><option value="custom">custom</option></select></td>
      <td className="text-right"><button className="btn btn-ghost !py-1 text-sm" onClick={save}>Save</button></td></tr>
  );
}

export default function Admin() {
  const me = useMe();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const enabled = !!me.data?.is_superadmin;
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => api<Stats>("/admin/stats", { org: false }), enabled });
  const orgs = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api<{ items: Org[] }>("/admin/organizations", { org: false }), enabled });
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => api<{ items: Plan[] }>("/admin/plans", { org: false }), enabled });
  const jobs = useQuery({ queryKey: ["admin-jobs"], queryFn: () => api<{ items: { id: string; kind: string; status: string; progress: number; triggered_by: string; error: string | null; created_at: string }[] }>("/admin/jobs", { org: false }), enabled });
  const leads = useQuery({ queryKey: ["admin-leads"], queryFn: () => api<{ items: { id: string; kind: string; name: string; email: string; organization: string; message: string; created_at: string }[] }>("/admin/contact-requests", { org: false }), enabled });
  if (me.data && !me.data.is_superadmin) return <ErrorState error={{ status: 403, message: "Platform super admins only." }} />;
  const toggle = async (o: Org) => { try { await api(`/admin/organizations/${o.id}`, { method: "PATCH", org: false, body: { status: o.status === "active" ? "suspended" : "active" } }); qc.invalidateQueries({ queryKey: ["admin-orgs"] }); } catch (e) { setMsg((e as ApiError).message); } };
  const s = stats.data;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-3xl font-semibold">Platform administration</h1>
      {msg && <p role="status" className="panel p-3 text-sm">{msg}</p>}
      {stats.isError && <ErrorState error={stats.error} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Organizations" value={s?.organizations ?? "…"} /><Stat label="Active users" value={s?.active_users ?? "…"} /><Stat label="Farms" value={s?.farms ?? "…"} />
        <Stat label="Simulations" value={s?.simulations ?? "…"} /><Stat label="Open enquiries" value={s?.open_contact_requests ?? "…"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Data ingestion and NASA API status">
          {!s ? <Skeleton /> : <ul className="space-y-2 text-sm">{s.data_sources.map((d) => <li key={d.key} className="flex justify-between gap-3"><span>{d.key}</span><span className={d.status === "operational" ? "text-emerald" : d.status === "degraded" ? "text-amber" : "text-muted"}>{d.status.replace("_", " ")}</span></li>)}</ul>}
          {s?.data_sources.filter((d) => d.last_error).map((d) => <p key={d.key} className="mt-2 text-xs text-rose">{d.key}: {d.last_error?.slice(0, 200)}</p>)}
        </Panel>
        <Panel title="Background jobs and models">
          <p className="text-sm">Jobs: {s ? Object.entries(s.jobs).map(([k, v]) => `${k} ${v}`).join(", ") || "none yet" : "…"}</p>
          <p className="mt-2 text-sm">ML models: {s?.models.length ? s.models.map((m) => `${m.name} ${m.version} (${m.status})`).join(", ") : "none registered. Yield predictions stay disabled until a model is evaluated."}</p>
          <ul className="mt-3 divide-y divide-line text-xs">{jobs.data?.items.slice(0, 8).map((j) => <li key={j.id} className="flex justify-between py-1.5"><span>{j.kind} ({j.triggered_by})</span><span className={j.status === "failed" ? "text-rose" : j.status === "succeeded" ? "text-emerald" : ""}>{j.status} {j.progress}%</span></li>)}</ul>
        </Panel>
      </div>
      <Panel title="Subscription plan pricing">
        <p className="mb-3 text-sm text-muted">Leave the price empty to show &ldquo;Pricing on request&rdquo; on the public site.</p>
        <table className="w-full text-sm"><tbody>{plans.data?.items.map((p) => <PlanEditor key={p.key} p={p} onSaved={(m) => { setMsg(m); qc.invalidateQueries({ queryKey: ["admin-plans"] }); }} />)}</tbody></table>
      </Panel>
      <Panel title="Customers">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted"><th className="pb-2">Organization</th><th>Industry</th><th>Plan</th><th>Members</th><th>Status</th><th /></tr></thead>
          <tbody>{orgs.data?.items.map((o) => <tr key={o.id} className="border-t border-line"><td className="py-2 font-medium">{o.name}</td><td className="capitalize">{o.industry}</td><td>{o.plan} ({o.subscription_status})</td><td>{o.members}</td><td className={o.status === "active" ? "text-emerald" : "text-rose"}>{o.status}</td>
            <td className="text-right"><button className="text-xs hover:underline" onClick={() => toggle(o)}>{o.status === "active" ? "Suspend" : "Reactivate"}</button></td></tr>)}</tbody></table></div>
      </Panel>
      <Panel title="Demo and contact requests">
        <ul className="divide-y divide-line text-sm">{leads.data?.items.map((l) => <li key={l.id} className="py-2"><p><span className="font-medium">{l.name}</span> <span className="text-muted">{l.email}, {l.organization}</span> <span className="rounded-full bg-panel-2 px-2 text-xs">{l.kind}</span></p>{l.message && <p className="text-muted">{l.message}</p>}</li>)}</ul>
        {!leads.data?.items.length && <p className="text-sm text-muted">No requests yet.</p>}
      </Panel>
      <Panel title="System announcement">
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); try { await api("/admin/announcements", { org: false, body: { title: f.get("title"), body: f.get("body") } }); setMsg("Announcement published."); form.reset(); } catch (x) { setMsg((x as ApiError).message); } }}>
          <input name="title" required placeholder="Title" aria-label="Title" className="field" /><textarea name="body" required rows={3} placeholder="Message to all organizations" aria-label="Message" className="field" />
          <button className="btn btn-primary w-fit">Publish announcement</button>
        </form>
      </Panel>
    </div>
  );
}
