"use client";
import Link from "next/link";
import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTag, Empty, ErrorState, Panel, ProvenanceNote, Skeleton, Stat } from "@/components/ui/kit";
import DistrictSelect from "@/components/app/DistrictSelect";
import { axis, C, grid, tooltip } from "@/components/app/charts";
import { fmt, useMe, useOrgQuery } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-store";
import type { Provenance } from "@/lib/types";

type Overview = { farms: { count: number; hectares: number; with_boundary: number; districts: string[] }; simulations: number;
  latest_recommendation: { district: string; season: string; recommended: string } | null; market: { commodities: number; last_import_at: string | null };
  data_sources: { key: string; product: string; status: string; last_success_at: string | null }[] };
type Anomaly = { district: string; start: string; end: string; observed_mm: number; normal_mm: number; anomaly_pct: number | null; max_temp_c: number | null; heavy_rain_days: number; climate_risk: { score: number | null; components: Record<string, number> }; provenance: Provenance[] };
type Daily = { series: { date: string; t2m: number | null; precip_mm: number | null }[]; summary: { total_precip_mm: number | null; mean_temp_c: number | null }; provenance: Provenance };
type Soil = { summary: { latest_root_zone: number | null; water_stress: string | null } };

const FOCUS: Record<string, { title: string; links: [string, string][] }> = {
  farm: { title: "Farm portfolio", links: [["/app/crops", "Pick crops for the coming season"], ["/app/simulator", "Compare crops under a dry-season scenario"], ["/app/map", "Draw your farm boundaries"]] },
  agribusiness: { title: "Sourcing regions", links: [["/app/crops", "Check suitability across sourcing districts"], ["/app/market", "Import and compare market prices"], ["/app/simulator", "Stress-test supply scenarios"]] },
  insurance: { title: "Portfolio exposure", links: [["/app/risk", "Review drought and excess-rain indicators"], ["/app/map", "See exposure on the map"], ["/app/climate", "Check rainfall anomalies by district"]] },
  banking: { title: "Lending decision support", links: [["/app/risk", "Assess crop-related climate risk"], ["/app/simulator", "Attach a scenario report to a credit file"], ["/app/profitability", "Check borrower crop margins"]] },
  government: { title: "District monitoring", links: [["/app/climate", "Compare district climate indicators"], ["/app/crops", "Monitor crop suitability"], ["/app/map", "Regional comparison map"]] },
};

export default function Overview() {
  const [district, setDistrict] = useState("Anuradhapura");
  const me = useMe();
  const orgId = useAuth((s) => s.orgId);
  const m = me.data?.memberships.find((x) => x.org_id === orgId);
  const ov = useOrgQuery<Overview>(["overview"], "/dashboard/overview");
  const an = useOrgQuery<Anomaly>(["anomaly", district], `/climate/anomaly?district=${encodeURIComponent(district)}&days=30`, !!m?.features.includes("climate"));
  const daily = useOrgQuery<Daily>(["daily90", district], `/climate/daily?district=${encodeURIComponent(district)}`, !!m?.features.includes("climate"));
  const soil = useOrgQuery<Soil>(["soil", district], `/soil/moisture?district=${encodeURIComponent(district)}`, !!m?.features.includes("soil_water"));
  const focus = FOCUS[m?.industry ?? "farm"] ?? FOCUS.farm;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">{m?.org_name ?? "Overview"}</h1><p className="text-muted">{focus.title}</p></div>
        <div className="w-60"><DistrictSelect value={district} onChange={setDistrict} /></div>
      </div>

      {ov.isError && <ErrorState error={ov.error} onRetry={() => ov.refetch()} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Monitored farms" value={ov.data ? fmt(ov.data.farms.count) : "…"} sub={ov.data ? `${ov.data.farms.districts.length} districts` : undefined} />
        <Stat label="Monitored hectares" value={ov.data ? fmt(ov.data.farms.hectares, 1) : "…"} sub={ov.data ? `${ov.data.farms.with_boundary} farms with boundaries` : undefined} />
        <Stat label={`Rainfall vs normal, ${district}`} value={an.data?.anomaly_pct != null ? `${an.data.anomaly_pct > 0 ? "+" : ""}${fmt(an.data.anomaly_pct)}%` : an.isError ? "Unavailable" : "…"}
          sub={an.data ? `${fmt(an.data.observed_mm)} mm in 30 days vs ${fmt(an.data.normal_mm)} mm normal` : undefined} />
        <Stat label={`Root-zone soil wetness, ${district}`} value={soil.data?.summary.latest_root_zone != null ? fmt(soil.data.summary.latest_root_zone, 2) : soil.isError ? "Unavailable" : "…"}
          sub={soil.data?.summary.water_stress ? `Water stress ${soil.data.summary.water_stress}` : "Fraction 0–1, MERRA-2"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={`Last 90 days in ${district}`} tag="historical" className="lg:col-span-2">
          {daily.isLoading && <Skeleton h={260} />}
          {daily.isError && <ErrorState error={daily.error} onRetry={() => daily.refetch()} />}
          {daily.data && (<>
            <div className="h-64"><ResponsiveContainer>
              <ComposedChart data={daily.data.series}>
                <CartesianGrid {...grid} vertical={false} />
                <XAxis dataKey="date" {...axis} tickFormatter={(d) => d.slice(5)} minTickGap={30} />
                <YAxis yAxisId="r" {...axis} width={40} unit=" mm" />
                <YAxis yAxisId="t" orientation="right" {...axis} width={40} unit="°" domain={["auto", "auto"]} />
                <Tooltip {...tooltip} />
                <Bar yAxisId="r" dataKey="precip_mm" name="Rainfall (mm)" fill={C.cyan} radius={[3, 3, 0, 0]} />
                <Line yAxisId="t" dataKey="t2m" name="Mean temp (°C)" stroke={C.emerald} dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer></div>
            <ProvenanceNote p={daily.data.provenance} /></>)}
        </Panel>
        <Panel title="Climate risk indicator" tag="historical">
          {an.isLoading && <Skeleton h={200} />}
          {an.isError && <ErrorState error={an.error} onRetry={() => an.refetch()} />}
          {an.data && (<div className="space-y-3">
            <p className="font-display text-5xl font-semibold tabular">{an.data.climate_risk.score ?? "—"}<span className="text-lg text-muted"> / 100</span></p>
            {Object.entries(an.data.climate_risk.components).map(([k, v]) => (
              <div key={k}><div className="flex justify-between text-sm"><span className="capitalize">{k.replace("_", " ")}</span><span className="tabular">{fmt(v)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-panel-2"><div className="h-full rounded-full bg-amber" style={{ width: `${v}%` }} /></div></div>))}
            <p className="text-xs text-muted">{an.data.start} to {an.data.end}. Decision-support estimate.</p>
          </div>)}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Next steps">
          <ul className="space-y-2">{focus.links.map(([h, l]) => <li key={h}><Link href={h} className="text-cyan hover:underline">{l}</Link></li>)}</ul>
        </Panel>
        <Panel title="Crop suitability">
          {ov.data?.latest_recommendation ? (
            <p>Latest run: <span className="font-semibold capitalize">{ov.data.latest_recommendation.recommended?.replace("_", " ")}</span> ranked first for {ov.data.latest_recommendation.district}, {ov.data.latest_recommendation.season}.</p>
          ) : <Empty title="No recommendations yet" action={<Link href="/app/crops" className="text-sm text-cyan">Run a suitability check</Link>} />}
          <p className="mt-3 text-sm text-muted">Simulations run: {fmt(ov.data?.simulations)}</p>
        </Panel>
        <Panel title="Market prices">
          {ov.data?.market.commodities ? <p>{ov.data.market.commodities} commodities imported, last on {new Date(ov.data.market.last_import_at!).toLocaleDateString()}.</p>
            : <Empty title="No price data yet" action={<Link href="/app/market" className="text-sm text-cyan">Import a price CSV</Link>}>Prices are never estimated; import official series to see trends.</Empty>}
        </Panel>
      </div>

      <Panel title="Data feeds">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ov.data?.data_sources.map((s) => (
            <div key={s.key} className="rounded-lg border border-line p-3 text-sm">
              <p className="font-medium leading-snug">{s.product}</p>
              <p className={`mt-1 text-xs ${s.status === "operational" ? "text-emerald" : s.status === "degraded" ? "text-amber" : "text-muted"}`}>{s.status.replace("_", " ")}{s.last_success_at && `, last fetch ${new Date(s.last_success_at).toLocaleString()}`}</p>
            </div>))}
        </div>
      </Panel>
      <p className="flex items-center gap-2 text-xs text-muted"><DataTag kind="historical" /> means past observations or long-term normals. Nothing on this page is a forecast.</p>
    </div>
  );
}
