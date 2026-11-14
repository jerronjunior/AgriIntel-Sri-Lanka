"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Upload } from "lucide-react";
import { axis, C, grid, tooltip } from "@/components/app/charts";
import { DataTag, Empty, ErrorState, Label, Panel, Skeleton, Stat } from "@/components/ui/kit";
import { api, ApiError } from "@/lib/api";
import { fmt, useMe, useOrgQuery } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-store";

type Prices = { items: { commodity: string; market: string; district: string | null; price_date: string; price_type: string; price_lkr_per_kg: number; source: string }[]; total: number; last_import_at: string | null; empty_reason: string | null };
type Summary = { available: boolean; message?: string; observations: number; latest: { date: string; price: number; source: string }; mean: number; min: number; max: number; cv: number | null; seasonal: { month: number; mean: number; n: number }[]; districts: { district: string; mean: number; n: number }[]; forecast: { available: boolean; reason: string } };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Market() {
  const orgId = useAuth((s) => s.orgId);
  const me = useMe();
  const canImport = me.data?.memberships.find((m) => m.org_id === orgId)?.role === "org_admin";
  const qc = useQueryClient();
  const crops = useQuery({ queryKey: ["crops"], queryFn: () => api<{ items: { key: string; name: string }[] }>("/crops", { org: false }) });
  const [commodity, setCommodity] = useState("green_gram");
  const [msg, setMsg] = useState<string | null>(null);
  const prices = useOrgQuery<Prices>(["prices", commodity], `/market/prices?commodity=${commodity}&page_size=500`);
  const sum = useOrgQuery<Summary>(["msum", commodity], `/market/summary?commodity=${commodity}`);
  const series = [...(prices.data?.items ?? [])].reverse();

  async function upload(f: File) {
    const fd = new FormData(); fd.append("file", f);
    try {
      const r = await api<{ upserted: number; errors: { line: number; error: string }[] }>("/market/import", { form: fd });
      setMsg(`Imported ${r.upserted} rows${r.errors.length ? `; ${r.errors.length} rows rejected (first: line ${r.errors[0].line}, ${r.errors[0].error})` : ""}.`);
      qc.invalidateQueries({ queryKey: [orgId, "prices"] }); qc.invalidateQueries({ queryKey: [orgId, "msum"] });
    } catch (e) { setMsg((e as ApiError).message); }
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">Market intelligence</h1><p className="mt-1 text-muted">Price series you import from official sources. AgriIntel never estimates or scrapes prices.</p></div>
        <div className="flex items-end gap-3">
          <div><Label htmlFor="c">Commodity</Label><select id="c" className="field" value={commodity} onChange={(e) => setCommodity(e.target.value)}>{crops.data?.items.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></div>
          {canImport && <label className="btn btn-primary cursor-pointer"><Upload className="h-4 w-4" />Import CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>}
        </div>
      </div>
      {msg && <p role="status" className="panel p-3 text-sm">{msg}</p>}
      {(prices.isError || sum.isError) && <ErrorState error={prices.error ?? sum.error} />}
      {sum.isLoading && <Skeleton h={100} />}
      {sum.data && !sum.data.available && (
        <Empty title="No prices imported for this commodity" action={!canImport && <p className="text-xs">Ask an organization admin to import data.</p>}>
          <p>CSV columns: <code>commodity, market, district, price_date (YYYY-MM-DD), price_lkr_per_kg, source</code>, optional <code>price_type</code> (wholesale, retail, farmgate). Good sources include HARTI weekly price bulletins and the Department of Census and Statistics.</p>
        </Empty>)}
      {sum.data?.available && (<>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Latest price" value={`LKR ${fmt(sum.data.latest.price, 2)}/kg`} sub={`${sum.data.latest.date}, ${sum.data.latest.source}`} />
          <Stat label="Average" value={`LKR ${fmt(sum.data.mean, 2)}`} sub={`${sum.data.observations} observations`} />
          <Stat label="Range" value={`${fmt(sum.data.min)}–${fmt(sum.data.max)}`} sub="LKR/kg" />
          <Stat label="Volatility (CV)" value={fmt(sum.data.cv, 3)} sub="Feeds the market risk score" />
        </div>
        <Panel title="Price history" tag="historical">
          <div className="h-64"><ResponsiveContainer><LineChart data={series}><CartesianGrid {...grid} vertical={false} /><XAxis dataKey="price_date" {...axis} minTickGap={40} /><YAxis {...axis} width={50} /><Tooltip {...tooltip} /><Line dataKey="price_lkr_per_kg" name="LKR/kg" stroke={C.emerald} dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div>
          <p className="mt-2 text-xs text-muted">Last import {prices.data?.last_import_at ? new Date(prices.data.last_import_at).toLocaleString() : "—"}. {sum.data.forecast.reason}</p>
        </Panel>
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Seasonal pattern (mean by month)"><div className="h-56"><ResponsiveContainer><BarChart data={sum.data.seasonal.map((s) => ({ ...s, m: MONTHS[s.month - 1] }))}><CartesianGrid {...grid} vertical={false} /><XAxis dataKey="m" {...axis} /><YAxis {...axis} width={45} /><Tooltip {...tooltip} /><Bar dataKey="mean" fill={C.cyan} /></BarChart></ResponsiveContainer></div></Panel>
          <Panel title="By district or market"><div className="h-56"><ResponsiveContainer><BarChart data={sum.data.districts} layout="vertical"><XAxis type="number" {...axis} /><YAxis type="category" dataKey="district" {...axis} width={100} /><Tooltip {...tooltip} /><Bar dataKey="mean" fill={C.emerald} /></BarChart></ResponsiveContainer></div></Panel>
        </div>
      </>)}
      <p className="text-xs text-muted">Supply and demand indicators need official production and trade datasets; import them when available.</p>
      <span className="sr-only"><DataTag kind="historical" /></span>
    </div>
  );
}
