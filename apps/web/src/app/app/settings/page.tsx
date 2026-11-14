"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorState, Label, Panel, Skeleton } from "@/components/ui/kit";
import { api, ApiError } from "@/lib/api";
import { useMe, useOrgQuery } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-store";

type Member = { user_id: string; email: string; full_name: string; role: string; status: string };
type Usage = Record<string, { used: number; limit: number | null }>;
type Sub = { subscription: { status: string; current_period_end: string | null; plan: { name: string; features: string[] } } | null };
type Logs = { items: { action: string; user: string | null; created_at: string; meta: Record<string, unknown> }[] };
const ROLES = ["org_admin", "farm_manager", "insurance_analyst", "banking_analyst", "government_analyst", "viewer"];
const roleName = (r: string) => r.replace("org_admin", "Organization admin").replaceAll("_", " ");

export default function Settings() {
  const orgId = useAuth((s) => s.orgId);
  const me = useMe();
  const isAdmin = me.data?.memberships.find((m) => m.org_id === orgId)?.role === "org_admin";
  const qc = useQueryClient();
  const members = useOrgQuery<Member[]>(["members"], "/organizations/current/members");
  const usage = useOrgQuery<Usage>(["usage"], "/usage");
  const sub = useOrgQuery<Sub>(["sub"], "/subscriptions/current");
  const logs = useOrgQuery<Logs>(["audit"], "/organizations/current/audit-logs?page_size=20", isAdmin);
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg(ok); qc.invalidateQueries({ queryKey: [orgId, "members"] }); } catch (e) { setMsg((e as ApiError).message); } };
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-3xl font-semibold">Organization</h1>
      {msg && <p role="status" className="panel p-3 text-sm">{msg}</p>}
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Subscription">
          {sub.data?.subscription ? <>
            <p className="font-display text-2xl font-semibold">{sub.data.subscription.plan.name}</p>
            <p className="capitalize text-muted">{sub.data.subscription.status}{sub.data.subscription.current_period_end && `, until ${new Date(sub.data.subscription.current_period_end).toLocaleDateString()}`}</p>
            <a href="/contact?kind=subscription" className="mt-3 inline-block text-sm text-cyan">Change plan</a></> : <Skeleton h={60} />}
        </Panel>
        <Panel title="Usage">
          {usage.data ? <ul className="space-y-3 text-sm">{Object.entries(usage.data).map(([k, v]) => (
            <li key={k}><div className="flex justify-between capitalize"><span>{k.replaceAll("_", " ")}</span><span className="tabular">{v.used} / {v.limit ?? "unlimited"}</span></div>
              {v.limit && <div className="mt-1 h-1.5 rounded-full bg-panel-2"><div className={`h-full rounded-full ${v.used / v.limit > 0.9 ? "bg-rose" : "bg-emerald"}`} style={{ width: `${Math.min(100, (v.used / v.limit) * 100)}%` }} /></div>}</li>))}</ul> : <Skeleton h={80} />}
        </Panel>
      </div>
      <Panel title="Members">
        {members.isError && <ErrorState error={members.error} />}
        <table className="w-full text-sm"><tbody>{members.data?.map((m) => (
          <tr key={m.user_id} className="border-t border-line first:border-0">
            <td className="py-2"><p className="font-medium">{m.full_name}</p><p className="text-xs text-muted">{m.email}</p></td>
            <td>{isAdmin && m.user_id !== me.data?.id ? (
              <select aria-label={`Role for ${m.email}`} className="field !w-auto !py-1 capitalize" value={m.role} onChange={(e) => act(() => api(`/organizations/current/members/${m.user_id}`, { method: "PATCH", body: { role: e.target.value } }), "Role updated.")}>
                {ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}</select>) : <span className="capitalize">{roleName(m.role)}</span>}</td>
            <td className="text-right">{isAdmin && m.user_id !== me.data?.id && <button className="text-xs text-rose hover:underline" onClick={() => confirm(`Remove ${m.email}?`) && act(() => api(`/organizations/current/members/${m.user_id}`, { method: "DELETE" }), "Member removed.")}>Remove</button>}</td>
          </tr>))}</tbody></table>
        {isAdmin && (
          <form className="mt-5 grid items-end gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_200px_auto]" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); act(() => api("/organizations/current/invitations", { body: { email: f.get("email"), role: f.get("role") } }), `Invitation sent to ${f.get("email")}.`); }}>
            <div><Label htmlFor="ie">Invite by email</Label><input id="ie" name="email" type="email" required className="field" /></div>
            <div><Label htmlFor="ir">Role</Label><select id="ir" name="role" className="field capitalize">{ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}</select></div>
            <button className="btn btn-primary">Send invitation</button>
          </form>)}
      </Panel>
      {isAdmin && <Panel title="Audit log">
        <ul className="divide-y divide-line text-sm">{logs.data?.items.map((l, i) => <li key={i} className="flex justify-between gap-3 py-2"><span><span className="font-medium">{l.action}</span> <span className="text-muted">{l.user ?? "system"}</span></span><span className="text-xs text-muted">{new Date(l.created_at).toLocaleString()}</span></li>)}</ul>
      </Panel>}
    </div>
  );
}
