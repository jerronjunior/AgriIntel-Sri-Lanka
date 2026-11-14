"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import DistrictSelect from "@/components/app/DistrictSelect";
import { ErrorState, Label, Panel, Skeleton } from "@/components/ui/kit";
import { api } from "@/lib/api";
import { fmt, useOrgQuery } from "@/lib/hooks";

type Comp = { score: number | null; components: Record<string, number>; note?: string };
type Risk = { district: string; crop: string; season: string; climate: Comp; production: Comp; market: Comp; overall: { score: number | null; level: string; missing: string[]; weights?: Record<string, number> }; label: string; method_version: string };
const LV: Record<string, string> = { low: "text-emerald", moderate: "text-cyan", elevated: "text-amber", high: "text-rose", unknown: "text-muted" };

function Bar({ v }: { v: number }) { return <div className="mt-1 h-1.5 rounded-full bg-panel-2"><div className="h-full rounded-full bg-amber" style={{ width: `${Math.min(100, v)}%` }} /></div>; }

function RiskInner() {
  const sp = useSearchParams();
  const [district, setDistrict] = useState(sp.get("district") ?? "Monaragala");
  const [crop, setCrop] = useState("paddy");
  const [season, setSeason] = useState("maha");
  const crops = useQuery({ queryKey: ["crops"], queryFn: () => api<{ items: { key: string; name: string }[] }>("/crops", { org: false }) });
  const q = useOrgQuery<Risk>(["risk", district, crop, season], `/risk/district?district=${encodeURIComponent(district)}&crop=${crop}&season=${season}`);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div><h1 className="text-3xl font-semibold">Agricultural risk</h1><p className="mt-1 text-muted">Climate, production and market risk combined into one index you can trace back to its inputs.</p></div>
      <div className="panel grid gap-4 p-4 sm:grid-cols-3">
        <div><Label htmlFor="district">District</Label><DistrictSelect value={district} onChange={setDistrict} /></div>
        <div><Label htmlFor="cr">Crop</Label><select id="cr" className="field" value={crop} onChange={(e) => setCrop(e.target.value)}>{crops.data?.items.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></div>
        <div><Label htmlFor="se">Season</Label><select id="se" className="field" value={season} onChange={(e) => setSeason(e.target.value)}><option value="maha">Maha</option><option value="yala">Yala</option></select></div>
      </div>
      {q.isLoading && <Skeleton h={240} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.data && (<>
        <div className="panel flex flex-wrap items-center gap-8 p-6">
          <div><p className="text-sm text-muted">Overall agricultural risk</p><p className="font-display text-6xl font-semibold tabular">{q.data.overall.score ?? "—"}</p></div>
          <div><p className={`font-display text-3xl font-semibold capitalize ${LV[q.data.overall.level]}`}>{q.data.overall.level}</p>
            {q.data.overall.missing.length > 0 && <p className="text-sm text-muted">Excludes {q.data.overall.missing.join(", ")}: not enough data.</p>}</div>
          <p className="ml-auto max-w-xs text-sm text-amber">{q.data.label}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {([["Climate risk", q.data.climate, "Last 30 days vs 2001–2020 normal (NASA POWER)"], ["Production risk", q.data.production, "Seasonal suitability and water stress for this crop"], ["Market risk", q.data.market, "Volatility of imported prices"]] as const).map(([t, c, d]) => (
            <Panel key={t} title={t}>
              <p className="font-display text-4xl font-semibold tabular">{c.score ?? "—"}</p>
              <p className="mb-3 text-xs text-muted">{c.note ?? d}</p>
              {Object.entries(c.components).map(([k, v]) => <div key={k} className="mb-2 text-sm"><div className="flex justify-between"><span className="capitalize">{k.replaceAll("_", " ")}</span><span className="tabular">{fmt(v, k === "price_cv" ? 3 : 0)}</span></div>{k !== "price_cv" && <Bar v={v} />}</div>)}
            </Panel>))}
        </div>
        <p className="text-xs text-muted">Method {q.data.method_version}. Weights: {q.data.overall.weights ? Object.entries(q.data.overall.weights).map(([k, v]) => `${k} ${v}`).join(", ") : "default"}. Missing components are excluded and never imputed.</p>
      </>)}
    </div>
  );
}
export default function Page() { return <Suspense><RiskInner /></Suspense>; }
