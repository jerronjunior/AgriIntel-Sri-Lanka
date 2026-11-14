"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Plus, Trash2 } from "lucide-react";
import DistrictSelect from "@/components/app/DistrictSelect";
import { axis, C, grid, tooltip } from "@/components/app/charts";
import { DataTag, ErrorState, Label, Panel } from "@/components/ui/kit";
import { api, ApiError, download } from "@/lib/api";
import { fmt, lkr, useOrgQuery } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-store";
import type { Simulation } from "@/lib/types";

type CropIn = { crop: string; attainable_yield_t_per_ha: number; price_lkr_per_kg: number; costs_per_ha: Record<string, number> };
const COSTS = ["seed", "fertilizer", "labor", "irrigation", "transport", "other"] as const;
// Starting rows for the brief's Monaragala example. Yields are placeholders; prices and costs start empty for the user to fill.
const EXAMPLE: Record<string, CropIn> = {
  green_gram: { crop: "green_gram", attainable_yield_t_per_ha: 1.2, price_lkr_per_kg: 0, costs_per_ha: { seed: 0, fertilizer: 0, labor: 0, irrigation: 0, transport: 0, other: 0 } },
  sesame: { crop: "sesame", attainable_yield_t_per_ha: 0.9, price_lkr_per_kg: 0, costs_per_ha: { seed: 0, fertilizer: 0, labor: 0, irrigation: 0, transport: 0, other: 0 } },
  groundnut: { crop: "groundnut", attainable_yield_t_per_ha: 1.5, price_lkr_per_kg: 0, costs_per_ha: { seed: 0, fertilizer: 0, labor: 0, irrigation: 0, transport: 0, other: 0 } },
};

function Num({ value, onChange, step = 1, min = 0, id, label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; id: string; label: string }) {
  return <div><Label htmlFor={id}>{label}</Label><input id={id} type="number" inputMode="decimal" step={step} min={min} className="field tabular" value={Number.isNaN(value) ? "" : value} onChange={(e) => onChange(parseFloat(e.target.value))} /></div>;
}

export default function SimulatorPage() {
  const orgId = useAuth((s) => s.orgId);
  const qc = useQueryClient();
  const crops = useQuery({ queryKey: ["crops"], queryFn: () => api<{ items: { key: string; name: string }[] }>("/crops", { org: false }) });
  const history = useOrgQuery<{ items: { id: string; name: string; created_at: string; district: string; crops: string[]; rain_change_pct: number }[] }>(["sims"], "/simulations");
  const [name, setName] = useState("Monaragala Yala comparison");
  const [district, setDistrict] = useState("Monaragala");
  const [season, setSeason] = useState<"maha" | "yala">("yala");
  const [area, setArea] = useState(10);
  const [rain, setRain] = useState(-20);
  const [temp, setTemp] = useState(0);
  const [irrigation, setIrrigation] = useState<"none" | "partial" | "full">("none");
  const [manual, setManual] = useState(false);
  const [baseline, setBaseline] = useState({ mean_temp_c: 28, rainfall_mm: 450, elevation_m: 150 });
  const [rows, setRows] = useState<CropIn[]>(Object.values(EXAMPLE));
  const [result, setResult] = useState<Simulation | null>(null);

  const run = useMutation({
    mutationFn: () => api<Simulation>("/simulations", { body: {
      name, district, season, area_ha: area, rain_change_pct: rain, temp_change_c: temp, irrigation, crops: rows,
      baseline: manual ? { ...baseline, source: "user-supplied" } : null } }),
    onSuccess: (d) => { setResult(d); qc.invalidateQueries({ queryKey: [orgId, "sims"] }); },
  });
  const load = async (id: string) => setResult(await api<Simulation>(`/simulations/${id}`));
  const upd = (i: number, patch: Partial<CropIn>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const missingPrice = rows.some((r) => !r.price_lkr_per_kg);

  const chart = result?.results.map((r) => ({ name: r.name, profit: r.economics.net_profit_lkr, revenue: r.economics.revenue_lkr, cost: r.economics.total_cost_lkr,
    base: r.suitability_baseline, scen: r.suitability_scenario, demand: r.water.demand_m3, deficit: r.water.deficit_m3 }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div><h1 className="text-3xl font-semibold">Decision Simulator</h1>
        <p className="mt-1 max-w-3xl text-muted">Compare up to six crops under a climate scenario. The baseline comes from NASA POWER 2001–2020 normals for the district; yields, prices and costs are your assumptions.</p></div>

      <form onSubmit={(e) => { e.preventDefault(); run.mutate(); }} className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Panel title="Scenario">
          <div className="space-y-4">
            <div><Label htmlFor="nm">Scenario name</Label><input id="nm" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></div>
            <div><Label htmlFor="district">District</Label><DistrictSelect value={district} onChange={setDistrict} /></div>
            <fieldset><legend className="mb-1 text-sm font-medium text-muted">Season</legend>
              <div className="grid grid-cols-2 gap-2">{(["maha", "yala"] as const).map((s) => (
                <label key={s} className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm capitalize ${season === s ? "border-emerald bg-emerald/10" : "border-line"}`}>
                  <input type="radio" className="sr-only" checked={season === s} onChange={() => setSeason(s)} />{s}</label>))}</div></fieldset>
            <Num id="area" label="Cultivation area (ha)" value={area} onChange={setArea} step={0.1} />
            <div><Label htmlFor="rain">Rainfall change: <span className="tabular text-ink">{rain > 0 ? "+" : ""}{rain}%</span></Label>
              <input id="rain" type="range" min={-60} max={60} step={5} value={rain} onChange={(e) => setRain(+e.target.value)} className="w-full accent-emerald" /></div>
            <div><Label htmlFor="temp">Temperature change: <span className="tabular text-ink">{temp > 0 ? "+" : ""}{temp.toFixed(1)} °C</span></Label>
              <input id="temp" type="range" min={-2} max={4} step={0.5} value={temp} onChange={(e) => setTemp(+e.target.value)} className="w-full accent-emerald" /></div>
            <fieldset><legend className="mb-1 text-sm font-medium text-muted">Irrigation available</legend>
              <div className="grid grid-cols-3 gap-2">{(["none", "partial", "full"] as const).map((s) => (
                <label key={s} className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-sm capitalize ${irrigation === s ? "border-emerald bg-emerald/10" : "border-line"}`}>
                  <input type="radio" className="sr-only" checked={irrigation === s} onChange={() => setIrrigation(s)} />{s}</label>))}</div></fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="accent-emerald" />Enter the climate baseline myself</label>
            {manual && <div className="grid grid-cols-3 gap-2">
              <Num id="bt" label="Mean °C" value={baseline.mean_temp_c} step={0.1} onChange={(v) => setBaseline({ ...baseline, mean_temp_c: v })} />
              <Num id="br" label="Rain mm" value={baseline.rainfall_mm} onChange={(v) => setBaseline({ ...baseline, rainfall_mm: v })} />
              <Num id="be" label="Elev. m" value={baseline.elevation_m} onChange={(v) => setBaseline({ ...baseline, elevation_m: v })} /></div>}
          </div>
        </Panel>

        <Panel title="Crops and your assumptions" actions={rows.length < 6 && (
          <button type="button" className="btn btn-ghost !py-1.5 text-sm" onClick={() => {
            const next = crops.data?.items.find((c) => !rows.some((r) => r.crop === c.key));
            if (next) setRows([...rows, { crop: next.key, attainable_yield_t_per_ha: 1, price_lkr_per_kg: 0, costs_per_ha: Object.fromEntries(COSTS.map((c) => [c, 0])) }]);
          }}><Plus className="h-4 w-4" />Add crop</button>)}>
          <p className="mb-4 rounded-lg border border-amber/30 bg-amber/5 p-3 text-sm">Enter your own expected farm-gate price and per-hectare costs. The starting yields are placeholders, not recommendations.</p>
          <div className="space-y-4">
            {rows.map((r, i) => (
              <div key={i} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-end gap-3">
                  <div className="flex-1"><Label htmlFor={`c${i}`}>Crop</Label>
                    <select id={`c${i}`} className="field" value={r.crop} onChange={(e) => upd(i, { crop: e.target.value })}>
                      {crops.data?.items.map((c) => <option key={c.key} value={c.key} disabled={rows.some((x, j) => j !== i && x.crop === c.key)}>{c.name}</option>)}
                    </select></div>
                  <button type="button" aria-label="Remove crop" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded-lg p-2.5 text-muted hover:text-rose disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Num id={`y${i}`} label="Attainable yield t/ha" step={0.1} value={r.attainable_yield_t_per_ha} onChange={(v) => upd(i, { attainable_yield_t_per_ha: v })} />
                  <Num id={`p${i}`} label="Price LKR/kg" value={r.price_lkr_per_kg} onChange={(v) => upd(i, { price_lkr_per_kg: v })} />
                  {COSTS.map((c) => <Num key={c} id={`${c}${i}`} label={`${c[0].toUpperCase()}${c.slice(1)} LKR/ha`} step={1000} value={r.costs_per_ha[c] ?? 0} onChange={(v) => upd(i, { costs_per_ha: { ...r.costs_per_ha, [c]: v } })} />)}
                </div>
              </div>))}
          </div>
          {run.isError && <div className="mt-4"><ErrorState error={run.error} /></div>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" disabled={run.isPending}>{run.isPending ? "Running scenario…" : "Run scenario"}</button>
            {missingPrice && <p className="text-sm text-amber">Some crops have no price, so revenue will show as zero.</p>}
          </div>
        </Panel>
      </form>

      {result && (
        <section aria-live="polite" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><h2 className="text-2xl font-semibold">{result.name}</h2><DataTag kind="simulated" /></div>
            <button className="btn btn-ghost" onClick={() => download(`/simulations/${result.id}/report.pdf`, `agriintel-${result.id.slice(0, 8)}.pdf`).catch((e: ApiError) => alert(e.message))}><Download className="h-4 w-4" />Download PDF report</button>
          </div>
          <div className="panel grid gap-4 p-4 text-sm sm:grid-cols-3">
            <p><span className="text-muted">Baseline </span>{fmt(result.climate.baseline.rainfall_mm)} mm, {fmt(result.climate.baseline.mean_temp_c, 1)} °C<span className="block text-xs text-muted">{result.climate.baseline.source}</span></p>
            <p><span className="text-muted">Scenario </span>{fmt(result.climate.scenario.rainfall_mm)} mm, {fmt(result.climate.scenario.mean_temp_c, 1)} °C</p>
            <p className="text-muted">{result.disclaimer}</p>
          </div>
          <div className={`grid gap-4 ${["", "", "md:grid-cols-2", "md:grid-cols-3"][result.results.length] ?? "md:grid-cols-2 lg:grid-cols-3"}`}>
            {result.results.map((r) => (
              <article key={r.crop} className={`panel p-5 ${r.profit_rank === 1 ? "border-emerald/60" : ""}`}>
                <div className="flex items-start justify-between"><h3 className="text-xl font-semibold">{r.name}</h3>
                  <span className="rounded-full bg-panel-2 px-2 py-0.5 text-xs">Profit rank {r.profit_rank}</span></div>
                <p className="mt-1 text-sm capitalize text-muted">{r.suitability_class}, suitability {fmt(r.suitability_scenario)} / 100 (baseline {fmt(r.suitability_baseline)})</p>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted">Expected yield</dt><dd className="tabular text-right">{fmt(r.yield.expected_t_per_ha, 2)} t/ha</dd>
                  <dt className="text-muted">Revenue</dt><dd className="tabular text-right">{lkr(r.economics.revenue_lkr)}</dd>
                  <dt className="text-muted">Production cost</dt><dd className="tabular text-right">{lkr(r.economics.total_cost_lkr)}</dd>
                  <dt className="font-semibold">Net profit</dt><dd className={`tabular text-right font-semibold ${r.economics.net_profit_lkr < 0 ? "text-rose" : "text-emerald"}`}>{lkr(r.economics.net_profit_lkr)}</dd>
                  <dt className="text-muted">ROI</dt><dd className="tabular text-right">{r.economics.roi_pct == null ? "—" : `${fmt(r.economics.roi_pct, 1)}%`}</dd>
                  <dt className="text-muted">Water demand</dt><dd className="tabular text-right">{fmt(r.water.demand_m3)} m³</dd>
                  <dt className="text-muted">Water deficit</dt><dd className="tabular text-right">{fmt(r.water.deficit_m3)} m³</dd>
                  <dt className="text-muted">Overall risk</dt><dd className="text-right capitalize">{r.risk.overall.level} {r.risk.overall.score != null && `(${fmt(r.risk.overall.score)})`}</dd>
                </dl>
                {r.risk.overall.missing.length > 0 && <p className="mt-2 text-xs text-muted">Risk excludes: {r.risk.overall.missing.join(", ")} (no data).</p>}
                {r.constraints.length > 0 && <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-amber">{r.constraints.map((c) => <li key={c}>{c}</li>)}</ul>}
              </article>))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Revenue, cost and profit (LKR)">
              <div className="h-64"><ResponsiveContainer><BarChart data={chart}><CartesianGrid {...grid} vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} width={70} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} /><Tooltip {...tooltip} formatter={(v) => lkr(Number(v))} /><Legend />
                <Bar dataKey="revenue" name="Revenue" fill={C.cyan} /><Bar dataKey="cost" name="Cost" fill={C.slate} /><Bar dataKey="profit" name="Net profit" fill={C.emerald} /></BarChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Suitability, baseline vs scenario">
              <div className="h-64"><ResponsiveContainer><BarChart data={chart}><CartesianGrid {...grid} vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} domain={[0, 100]} width={35} /><Tooltip {...tooltip} /><Legend />
                <Bar dataKey="base" name="Baseline" fill={C.slate} /><Bar dataKey="scen" name="Scenario" fill={C.amber} /></BarChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Water demand and deficit (m³)">
              <div className="h-64"><ResponsiveContainer><BarChart data={chart}><CartesianGrid {...grid} vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} width={60} /><Tooltip {...tooltip} formatter={(v) => fmt(Number(v))} /><Legend />
                <Bar dataKey="demand" name="Demand" fill={C.cyan} /><Bar dataKey="deficit" name="Deficit" fill={C.rose} /></BarChart></ResponsiveContainer></div>
            </Panel>
          </div>
          <Panel title="Assumptions used">
            <dl className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">{Object.entries(result.assumptions).map(([k, v]) => <div key={k}><dt className="capitalize text-muted">{k.replaceAll("_", " ")}</dt><dd>{String(v)}</dd></div>)}</dl>
          </Panel>
        </section>
      )}

      <Panel title="Saved scenarios">
        {history.isError && <ErrorState error={history.error} />}
        {!history.data?.items.length ? <p className="text-sm text-muted">Scenarios you run are saved here with their assumptions.</p> : (
          <ul className="divide-y divide-line">{history.data.items.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <button onClick={() => load(h.id)} className="text-left hover:text-cyan"><span className="font-medium">{h.name}</span><span className="block text-xs text-muted">{h.district}, {h.crops.join(", ").replaceAll("_", " ")}, rainfall {h.rain_change_pct}%</span></button>
              <span className="text-xs text-muted">{new Date(h.created_at).toLocaleString()}</span>
            </li>))}</ul>)}
      </Panel>
    </div>
  );
}
