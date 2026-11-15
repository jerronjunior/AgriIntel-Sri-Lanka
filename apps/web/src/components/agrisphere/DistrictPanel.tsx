"use client";
import { useMemo, useState } from "react";
import { DistrictNasaPanel } from "@/components/nasa/DistrictNasaPanel";
import { Send, Sparkles } from "lucide-react";
import {
  allocate, cropName, lendingBand, MONTHS, OPP_WEIGHTS, SEASON_INFO,
  type CropIntel, type DistrictIntel, type Level3, type Level5, type S, type Source,
} from "@/lib/agrisphere/model";
import { answer, type CopilotAnswer } from "@/lib/agrisphere/copilot";

// ---------------------------------------------------------------- small primitives
const SRC: Record<Source, { label: string; cls: string; title: string }> = {
  live: { label: "Live", cls: "border-cyan/50 text-cyan", title: "From the AgriIntel API (NASA POWER-backed)" },
  mixed: { label: "Partly demo", cls: "border-amber/60 text-amber", title: "Some values live, others illustrative" },
  demo: { label: "Demo", cls: "border-rose/60 text-rose", title: "Illustrative values until a real source is connected" },
  none: { label: "Not connected", cls: "border-line text-muted", title: "No data source connected yet" },
};
export function SrcTag({ src, note }: { src: Source; note?: string }) {
  const t = SRC[src];
  return <span title={note ?? t.title} className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${t.cls}`}>{t.label}</span>;
}

const toneOf = (l: Level3 | Level5, risk = true) => {
  const bad = ["High", "Critical"].includes(l), mid = ["Medium", "Moderate"].includes(l);
  if (!risk) return bad ? "text-emerald" : mid ? "text-amber" : "text-rose";
  return bad ? "text-rose" : mid ? "text-amber" : "text-emerald";
};

function Meter({ label, value, risk = false, suffix = "" }: { label: string; value: number; risk?: boolean; suffix?: string }) {
  const c = risk ? (value >= 60 ? "bg-rose" : value >= 35 ? "bg-amber" : "bg-emerald") : value >= 70 ? "bg-emerald" : value >= 45 ? "bg-cyan" : "bg-amber";
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-muted">{label}</span><span className="tabular font-medium">{value}{suffix}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-panel-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
        <div className={`h-full rounded-full ${c}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function Tile({ label, children, s, sub }: { label: string; children: React.ReactNode; s?: S<unknown>; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-start justify-between gap-2"><p className="text-xs text-muted">{label}</p>{s && <SrcTag src={s.src} note={s.note} />}</div>
      <div className="mt-1 font-display text-xl font-semibold tabular">{children}</div>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Section({ title, s, children, note }: { title: string; s?: S<unknown>; children: React.ReactNode; note?: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2"><h3 className="font-semibold">{title}</h3>{s && <SrcTag src={s.src} note={s.note} />}</div>
      {children}
      {note && <p className="text-xs text-muted">{note}</p>}
    </section>
  );
}

const lkr = (v: number) => `LKR ${Math.round(v).toLocaleString("en-LK")}`;

// ---------------------------------------------------------------- opportunity score
function OpportunityScore({ crops, src, note }: { crops: CropIntel[]; src: Source; note?: string }) {
  const [sel, setSel] = useState(crops[0].crop);
  const c = crops.find((x) => x.crop === sel) ?? crops[0];
  const parts: [string, number, number][] = [
    ["Suitability", c.suitability, OPP_WEIGHTS.suitability], ["Yield", c.yieldScore, OPP_WEIGHTS.yield], ["Market", c.market, OPP_WEIGHTS.market],
    ["Climate", c.climate, OPP_WEIGHTS.climate], ["Profitability", c.profitability, OPP_WEIGHTS.profitability],
  ];
  const R = 54, C = 2 * Math.PI * R;
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Agricultural Opportunity Score</h3><SrcTag src={src} note={note} />
      </div>
      <div role="tablist" aria-label="Crop" className="mt-3 flex flex-wrap gap-1.5">
        {crops.slice(0, 5).map((x) => (
          <button key={x.crop} role="tab" aria-selected={x.crop === c.crop} onClick={() => setSel(x.crop)}
            className={`rounded-full border px-3 py-1 text-sm ${x.crop === c.crop ? "border-emerald bg-emerald/12 text-ink" : "border-line text-muted hover:text-ink"}`}>
            {cropName(x.crop)}
          </button>
        ))}
      </div>
      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[150px_1fr]">
        <div className="relative mx-auto h-[150px] w-[150px]">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="70" cy="70" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="12" />
            <circle cx="70" cy="70" r={R} fill="none" stroke="#10B981" strokeWidth="12" strokeLinecap="round"
              strokeDasharray={`${(c.opportunity / 100) * C} ${C}`} style={{ transition: "stroke-dasharray .6s cubic-bezier(.2,.7,.2,1)" }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div><p className="font-display text-4xl font-semibold tabular">{c.opportunity}</p><p className="text-xs text-muted">of 100</p></div>
          </div>
        </div>
        <div className="space-y-2.5">
          {parts.map(([l, v, w]) => <Meter key={l} label={`${l} (weight ${Math.round(w * 100)}%)`} value={v} />)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- decision package
function DecisionPackage({ d, hectares }: { d: DistrictIntel; hectares: number }) {
  const top = d.crops.v[0];
  const plan = allocate(d.crops.v, hectares);
  const season = SEASON_INFO[d.season];
  const items: [string, React.ReactNode, React.ReactNode?][] = [
    ["What to grow", cropName(top.crop), d.crops.v.slice(1, 3).map((c) => cropName(c.crop)).join(", ") + " as alternatives"],
    ["Where to grow", d.name, `${d.zone} zone, ${d.soilType}`],
    ["When to grow", season.sowing, `${season.name} season sowing window`],
    ["How much to grow", `${plan[0]?.ha ?? 0} ha`, `of ${hectares} ha, as part of a ${plan.length}-crop mix`],
    ["Expected profit", lkr(top.profitHa), `per hectare, ROI ${top.roi}%`],
    ["Expected risk", `${d.insurance.overall.v}/100`, `drought ${d.insurance.drought.v}, flood ${d.insurance.flood.v}`],
    ["Expected demand", d.market.demand.v, `price trend ${d.market.priceTrend.v.toLowerCase()}`],
    ["Expected harvest", MONTHS[season.harvestMonth - 1], `${top.yieldExpected} t/ha expected`],
  ];
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Decision package</h3><SrcTag src={d.crops.src === "live" ? "mixed" : d.crops.src} /></div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
        {items.map(([k, v, sub]) => (
          <div key={k} className="border-l-2 border-emerald/40 pl-3">
            <dt className="text-xs text-muted">{k}</dt><dd className="font-display text-lg font-semibold leading-tight">{v}</dd>
            {sub && <dd className="mt-0.5 text-xs text-muted">{sub}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------- module tabs
const TABS = ["Climate", "Water", "Soil", "Crops", "Yield & profit", "Market", "Export", "Insurance", "Lending", "Copilot"] as const;
type Tab = (typeof TABS)[number];
const LEVEL_BG: Record<Level5, string> = { "Very low": "#0f4c5c", Low: "#0f766e", Moderate: "#a16207", High: "#d9480f", Critical: "#e11d48" };

function ClimateTab({ d }: { d: DistrictIntel }) {
  const c = d.climate;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Climate stability" s={c.stability}>{c.stability.v}%</Tile>
        <Tile label="Rainfall deviation" s={c.rainfallDeviation} sub={c.rainfallDeviation.src === "live" ? "last 30 days vs 2001–2020 normal" : undefined}>
          {c.rainfallDeviation.v > 0 ? "+" : ""}{c.rainfallDeviation.v}%</Tile>
        <Tile label="Heat stress" s={c.heatStress}><span className={toneOf(c.heatStress.v)}>{c.heatStress.v}</span></Tile>
        <Tile label="Water security" s={c.waterSecurity}><span className={toneOf(c.waterSecurity.v, false)}>{c.waterSecurity.v}</span></Tile>
      </div>
      <Section title={`${SEASON_INFO[d.season].name} season normals`} s={c.seasonRainMm}>
        {c.seasonRainMm.v == null ? <p className="text-sm text-muted">Sign in to the dashboard to load NASA POWER 2001–2020 normals for this district.</p> : (
          <p className="text-sm">Mean temperature <span className="font-semibold tabular">{c.meanTempC.v} °C</span>, seasonal rainfall <span className="font-semibold tabular">{c.seasonRainMm.v} mm</span>.</p>)}
      </Section>
      <Section title="Monthly drought risk" s={c.droughtByMonth}>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {c.droughtByMonth.v.map((l, i) => (
            <div key={i} className="text-center" title={`${MONTHS[i]}: ${l}`}>
              <div className="h-9 rounded-md" style={{ background: LEVEL_BG[l] }} />
              <p className={`mt-1 text-[11px] ${SEASON_INFO[d.season].months.includes(i + 1) ? "font-semibold text-ink" : "text-muted"}`}>{MONTHS[i]}</p>
            </div>))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted">{(Object.keys(LEVEL_BG) as Level5[]).map((l) => <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVEL_BG[l] }} />{l}</span>)}</div>
      </Section>
      <Section title="Flood risk, next 7 days" s={c.floodNext7} note="Needs a forecast feed (e.g. Department of Meteorology or a numerical weather model). Historical observations are never shown as forecasts.">
        <p className={`font-display text-2xl font-semibold ${toneOf(c.floodNext7.v)}`}>{c.floodNext7.v} probability</p>
      </Section>
    </div>
  );
}

function WaterTab({ d }: { d: DistrictIntel }) {
  const w = d.water;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        <Tile label="Water Availability Index" s={w.index} sub="0–100">{w.index.v}</Tile>
        <div className="space-y-2.5">
          <Meter label="Reservoir support" value={w.reservoir.v} /><Meter label="Groundwater availability" value={w.groundwater.v} />
          <Meter label="Rainfall potential" value={w.rainfallPotential.v} /><Meter label="Soil water retention" value={w.soilRetention.v} />
        </div>
      </div>
      <Section title="Root-zone soil wetness" s={w.rootZoneWetness}>
        <p className="text-sm">{w.rootZoneWetness.v == null ? "Available in the signed-in dashboard (NASA POWER, MERRA-2)." : <>Latest <span className="font-semibold tabular">{w.rootZoneWetness.v.toFixed(2)}</span> (0 = dry, 1 = saturated). Regional indicator, not field-level.</>}</p>
      </Section>
      <Section title="Irrigation requirement per season" s={d.crops}>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted"><th className="pb-2 font-normal">Crop</th><th className="font-normal">Water required</th><th className="font-normal">Per hectare</th></tr></thead>
          <tbody>{d.crops.v.slice().sort((a, b) => a.waterMm - b.waterMm).map((c) => (
            <tr key={c.crop} className="border-t border-line"><td className="py-1.5">{cropName(c.crop)}</td><td className="tabular">{c.waterMm} mm</td><td className="tabular text-muted">{(c.waterMm * 10).toLocaleString()} m³</td></tr>))}</tbody></table>
      </Section>
    </div>
  );
}

function SoilTab({ d }: { d: DistrictIntel }) {
  const s = d.soil;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile label="Dominant soil group (indicative)" s={{ v: d.soilType, src: "demo", note: "Generalised by agro-climatic zone; replace with Land Use Policy Planning Department soil maps" }}>{d.soilType}</Tile>
        <Tile label="Agro-climatic zone" s={{ v: d.zone, src: "demo" }}>{d.zone}</Tile>
      </div>
      <Section title="Suitable crops" s={d.crops}>
        <div className="space-y-2.5">{d.crops.v.slice().sort((a, b) => b.suitability - a.suitability).slice(0, 4).map((c) => <Meter key={c.crop} label={cropName(c.crop)} value={c.suitability} suffix="%" />)}</div>
      </Section>
      <Section title="Soil health indicators" s={s.drainage}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([["Drainage", s.drainage.v, false], ["Compaction risk", s.compaction.v, true], ["Erosion risk", s.erosion.v, true], ["Water holding capacity", s.waterHolding.v, false]] as const).map(([k, v, risk]) => (
            <div key={k} className="rounded-xl border border-line p-3"><dt className="text-xs text-muted">{k}</dt><dd className={`font-semibold ${toneOf(v, risk)}`}>{v}</dd></div>))}
        </dl>
      </Section>
    </div>
  );
}

function CropsTab({ d, hectares, setHectares }: { d: DistrictIntel; hectares: number; setHectares: (n: number) => void }) {
  const plan = allocate(d.crops.v, hectares);
  const colors = ["#10B981", "#22D3EE", "#F59E0B", "#A78BFA"];
  return (
    <div className="space-y-6">
      <Section title={`Best crops, ${SEASON_INFO[d.season].name} season`} s={d.crops}>
        <ol className="space-y-2">{d.crops.v.map((c, i) => (
          <li key={c.crop} className={`grid grid-cols-[20px_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm ${d.avoid.v.includes(c.crop) ? "opacity-50" : ""}`}>
            <span className="tabular text-muted">{i + 1}</span>
            <div><div className="flex justify-between"><span className="font-medium">{cropName(c.crop)}</span><span className="tabular text-muted">suitability {c.suitability}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-panel-2"><div className="h-full rounded-full bg-emerald" style={{ width: `${c.opportunity}%` }} /></div></div>
            <span className="tabular text-right font-semibold" title="Opportunity score">{c.opportunity}</span>
          </li>))}</ol>
        {d.avoid.v.length > 0 && <p className="text-sm"><span className="font-semibold text-rose">Avoid: </span>{d.avoid.v.map(cropName).join(", ")} <SrcTag src={d.avoid.src} note={d.avoid.note} /></p>}
      </Section>
      <Section title="Crop diversification plan" s={d.crops} note="Splits land across the strongest suitable crops in proportion to their opportunity score, to spread climate and market risk.">
        <label className="flex items-center gap-3 text-sm">Land
          <input type="number" min={1} max={100000} value={hectares} onChange={(e) => setHectares(Math.max(1, +e.target.value || 1))} className="field !w-28 !py-1.5 tabular" aria-label="Land in hectares" />hectares</label>
        <div className="flex h-8 overflow-hidden rounded-lg" aria-hidden>{plan.map((p, i) => <div key={p.crop} style={{ width: `${p.pct}%`, background: colors[i] }} />)}</div>
        <ul className="grid gap-2 sm:grid-cols-2">{plan.map((p, i) => (
          <li key={p.crop} className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-sm" style={{ background: colors[i] }} />
            <span className="font-semibold tabular">{p.pct}%</span> {cropName(p.crop)} <span className="tabular text-muted">({p.ha} ha)</span></li>))}</ul>
      </Section>
    </div>
  );
}

function YieldTab({ d, hectares }: { d: DistrictIntel; hectares: number }) {
  const max = Math.max(...d.crops.v.map((c) => c.yieldBest));
  return (
    <div className="space-y-6">
      <Section title="Yield range (t/ha): worst, expected, best" s={{ v: 0, src: "demo", note: "No yield model has been evaluated on held-out data yet" }}
        note="Shown as demo until a yield model passes held-out evaluation on official production statistics.">
        <ul className="space-y-3">{d.crops.v.map((c) => (
          <li key={c.crop} className="grid grid-cols-[110px_1fr_150px] items-center gap-3 text-sm">
            <span>{cropName(c.crop)}</span>
            <div className="relative h-2 rounded-full bg-panel-2">
              <div className="absolute h-2 rounded-full bg-cyan/40" style={{ left: `${(c.yieldWorst / max) * 100}%`, width: `${((c.yieldBest - c.yieldWorst) / max) * 100}%` }} />
              <div className="absolute -top-1 h-4 w-1 rounded bg-emerald" style={{ left: `${(c.yieldExpected / max) * 100}%` }} />
            </div>
            <span className="tabular text-right text-muted">{c.yieldWorst} / <span className="font-semibold text-ink">{c.yieldExpected}</span> / {c.yieldBest}</span>
          </li>))}</ul>
      </Section>
      <Section title={`Profitability for ${hectares} ha`} s={d.crops}>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead><tr className="text-left text-muted"><th className="pb-2 font-normal">Crop</th><th className="font-normal">Revenue</th><th className="font-normal">Cost</th><th className="font-normal">Profit</th><th className="font-normal">ROI</th></tr></thead>
          <tbody>{d.crops.v.slice().sort((a, b) => b.profitHa - a.profitHa).map((c) => (
            <tr key={c.crop} className="tabular border-t border-line"><td className="py-1.5 font-sans font-medium">{cropName(c.crop)}</td>
              <td>{lkr(c.revenueHa * hectares)}</td><td>{lkr(c.costHa * hectares)}</td>
              <td className={c.profitHa < 0 ? "text-rose" : "text-emerald"}>{lkr(c.profitHa * hectares)}</td><td>{c.roi}%</td></tr>))}</tbody></table></div>
      </Section>
    </div>
  );
}

function MarketTab({ d }: { d: DistrictIntel }) {
  const m = d.market;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Tile label="Market demand score" s={m.demand}><span className={toneOf(m.demand.v, false)}>{m.demand.v}</span></Tile>
      <div className="rounded-xl border border-line p-3 md:col-span-2">
        <div className="flex justify-between gap-2"><p className="text-xs text-muted">Market saturation</p><SrcTag src={m.saturation.src} /></div>
        <p className="mt-1 font-display text-xl font-semibold">{cropName(m.saturation.v.crop)}: <span className={toneOf(m.saturation.v.risk)}>{m.saturation.v.risk} risk</span></p>
        <p className="mt-1 text-sm text-muted">{m.saturation.v.reason}</p>
      </div>
      <div className="rounded-xl border border-line p-3 md:col-span-3">
        <div className="flex justify-between gap-2"><p className="text-xs text-muted">Harvest window analysis</p><SrcTag src={m.priceTrend.src} /></div>
        <dl className="mt-2 grid grid-cols-3 gap-4">
          <div><dt className="text-xs text-muted">Expected harvest</dt><dd className="font-display text-lg font-semibold">{MONTHS[SEASON_INFO[d.season].harvestMonth - 1]}</dd></div>
          <div><dt className="text-xs text-muted">Market demand</dt><dd className="font-display text-lg font-semibold">{m.demand.v}</dd></div>
          <div><dt className="text-xs text-muted">Expected price</dt><dd className="font-display text-lg font-semibold">{m.priceTrend.v}</dd></div>
        </dl>
      </div>
      <p className="text-xs text-muted md:col-span-3">Connects to imported official price series (HARTI, Department of Agrarian Development, Central Bank) and production estimates. Price direction stays illustrative until a validated forecast model exists.</p>
    </div>
  );
}

function ExportTab({ d }: { d: DistrictIntel }) {
  return (
    <Section title="Supply forecast for export crops" s={d.export}>
      {d.export.v.length === 0 ? <p className="text-sm text-muted">No export-oriented crops rank well here this season.</p> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
          <thead><tr className="text-left text-muted"><th className="pb-2 font-normal">Product</th><th className="font-normal">Expected production</th><th className="font-normal">Export quality</th><th className="font-normal">Harvest</th><th className="font-normal">Opportunity</th></tr></thead>
          <tbody>{d.export.v.map((e) => (
            <tr key={e.crop} className="border-t border-line"><td className="py-1.5 font-medium">{cropName(e.crop)}</td><td className="tabular">{e.productionT.toLocaleString()} t</td>
              <td>Grade {e.quality}</td><td>{e.harvest}</td><td className={toneOf(e.opportunity, false)}>{e.opportunity}</td></tr>))}</tbody></table></div>)}
    </Section>
  );
}

function InsuranceTab({ d }: { d: DistrictIntel }) {
  const i = d.insurance;
  const history: [string, boolean, string][] = [
    ["Rainfall history", true, "NASA POWER daily precipitation, cached per district"],
    ["Soil moisture history", true, "MERRA-2 root-zone wetness via NASA POWER; SMAP once processed"],
    ["Heat stress history", true, "NASA POWER daily maximum temperature"],
    ["Vegetation history", false, "Needs Sentinel-2 / MODIS NDVI ingestion"],
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        <Tile label="Overall insurance risk" s={i.overall} sub="0 = low, 100 = high"><span className={i.overall.v >= 60 ? "text-rose" : i.overall.v >= 35 ? "text-amber" : "text-emerald"}>{i.overall.v}</span></Tile>
        <div className="space-y-2.5"><Meter label="Flood risk" value={i.flood.v} risk /><Meter label="Drought risk" value={i.drought.v} risk /><Meter label="Yield volatility" value={i.yieldVolatility.v} risk /></div>
      </div>
      <Section title="Claims validation evidence" note="Lets insurers check a reported event against observed conditions for the same dates. Automated claim approval is out of scope.">
        <ul className="divide-y divide-line rounded-xl border border-line">{history.map(([k, ok, how]) => (
          <li key={k} className="flex items-start justify-between gap-3 p-3 text-sm"><span><span className="font-medium">{k}</span><span className="block text-xs text-muted">{how}</span></span>
            <span className={`shrink-0 text-xs font-semibold ${ok ? "text-emerald" : "text-muted"}`}>{ok ? "Stored" : "Not connected"}</span></li>))}</ul>
      </Section>
    </div>
  );
}

function LendingTab({ d }: { d: DistrictIntel }) {
  const l = d.lending;
  const b = lendingBand(l.overall.v);
  const tone = { emerald: "border-emerald/50 bg-emerald/8 text-emerald", amber: "border-amber/50 bg-amber/8 text-amber", rose: "border-rose/50 bg-rose/8 text-rose" }[b.tone];
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className={`rounded-xl border p-4 ${tone}`}>
          <p className="text-xs opacity-80">Agricultural credit risk</p><p className="font-display text-4xl font-semibold tabular">{l.overall.v}</p>
          <p className="mt-1 font-semibold">{b.label}</p><p className="mt-1 text-xs text-ink/80">{b.hint}</p>
        </div>
        <div className="space-y-2.5"><Meter label="Location risk" value={l.location.v} risk /><Meter label="Crop risk" value={l.crop.v} risk />
          <Meter label="Climate risk" value={l.climate.v} risk /><Meter label="Market risk" value={l.market.v} risk /><Meter label="Yield risk" value={l.yield.v} risk /></div>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted"><SrcTag src={l.overall.src} />A decision-support signal for credit officers. AgriSphere does not approve or reject loans; that decision stays with your credit committee.</p>
    </div>
  );
}

function CopilotTab({ d, national, hectares }: { d: DistrictIntel; national: DistrictIntel[]; hectares: number }) {
  const s = SEASON_INFO[d.season].name;
  const starters = [`What should I cultivate in ${d.name} for ${s}?`, `Plan ${hectares} hectares in ${d.name}`, `How much water will be required?`,
    "Which districts will have oversupply?", `What is the lending risk in ${d.name}?`];
  const [log, setLog] = useState<{ q: string; a: CopilotAnswer }[]>([]);
  const [q, setQ] = useState("");
  const ask = (text: string) => {
    if (!text.trim()) return;
    const byName = national.find((x) => text.toLowerCase().includes(x.name.toLowerCase())) ?? d;
    setLog((l) => [...l, { q: text, a: answer(text, byName, national) }]);
    setQ("");
  };
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-muted"><Sparkles className="h-4 w-4 text-emerald" />Answers are composed from this page&apos;s data, with sources tagged. A language-model copilot can replace this later using the same data.</p>
      <div className="flex flex-wrap gap-2">{starters.map((x) => <button key={x} onClick={() => ask(x)} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:border-cyan hover:text-ink">{x}</button>)}</div>
      <div className="space-y-4" aria-live="polite">
        {log.map(({ q: question, a }, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-emerald/15 px-4 py-2 text-sm">{question}</p>
            <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-panel-2 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{a.title}</p>{a.sources.map((s2) => <SrcTag key={s2} src={s2} />)}</div>
              {a.ranked && <ol className="mt-2 list-decimal space-y-0.5 pl-5">{a.ranked.map((r) => <li key={r}>{r}</li>)}</ol>}
              <ul className="mt-2 space-y-1 text-muted">{a.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              {a.facts.length > 0 && <dl className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2">{a.facts.map(([k, v]) => <div key={k}><dt className="inline text-muted">{k}: </dt><dd className="inline font-medium">{v}</dd></div>)}</dl>}
              <div className="mt-3 flex flex-wrap gap-2">{a.followUps.map((f) => <button key={f} onClick={() => ask(f)} className="text-xs text-cyan hover:underline">{f}</button>)}</div>
            </div>
          </div>))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask about ${d.name} or any district`} aria-label="Ask the copilot" className="field" />
        <button className="btn btn-primary !px-4" aria-label="Ask"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- panel
export default function DistrictPanel({ d, otherNames, provinceName, areaKm2, national, liveState, nasaState }: {
  d: DistrictIntel; otherNames: string; provinceName: string; areaKm2: number; national: DistrictIntel[];
  liveState?: { loading: boolean; errors: number } | null;
  nasaState?: { loading: boolean; error: string | null } | null;
}) {
  const [tab, setTab] = useState<Tab>("Climate");
  const [hectares, setHectares] = useState(100);
  const names = useMemo(() => otherNames.split(",").map((s) => s.replace(/(District|மாவட்டம்|දිස්ත්‍රික්කය)/g, "").trim()).filter(Boolean), [otherNames]);
  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">{provinceName} Province</p>
        <h2 className="text-4xl font-semibold">{d.name}</h2>
        <p className="mt-1 text-sm text-muted">{names.join(" / ")}{names.length ? ", " : ""}{Math.round(areaKm2).toLocaleString()} km², {d.zone.toLowerCase()} zone</p>
        {liveState && (
          <p className="mt-2 text-xs text-muted">{liveState.loading ? "Loading live NASA POWER data for this district…" :
            liveState.errors ? `${liveState.errors} live source(s) unavailable; those values fall back to demo and are tagged.` : "Live values loaded where available; everything else is tagged Demo."}</p>)}
      </header>
      <OpportunityScore key={`${d.id}-${d.season}-${d.crops.src}`} crops={d.crops.v} src={d.crops.src} note={d.crops.note} />
      <DecisionPackage d={d} hectares={hectares} />
      <details className="panel overflow-hidden">
        <summary className="cursor-pointer px-5 py-4 font-semibold text-ink">
          NASA Earth observation data
          <span className="ml-2 text-xs font-normal text-muted">
            {nasaState?.loading ? "Loading…" : nasaState?.error ? "Not connected" : "Source details"}
          </span>
        </summary>
        <div className="border-t border-line p-4">
          <DistrictNasaPanel district={d.name} />
        </div>
      </details>
      <div className="panel p-5">
        <div role="tablist" aria-label="Intelligence modules" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line pb-3">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${tab === t ? "bg-emerald/12 font-semibold text-ink" : "text-muted hover:text-ink"}`}>{t}</button>))}
        </div>
        <div role="tabpanel" aria-label={tab}>
          {tab === "Climate" && <ClimateTab d={d} />}
          {tab === "Water" && <WaterTab d={d} />}
          {tab === "Soil" && <SoilTab d={d} />}
          {tab === "Crops" && <CropsTab d={d} hectares={hectares} setHectares={setHectares} />}
          {tab === "Yield & profit" && <YieldTab d={d} hectares={hectares} />}
          {tab === "Market" && <MarketTab d={d} />}
          {tab === "Export" && <ExportTab d={d} />}
          {tab === "Insurance" && <InsuranceTab d={d} />}
          {tab === "Lending" && <LendingTab d={d} />}
          {tab === "Copilot" && <CopilotTab d={d} national={national} hectares={hectares} />}
        </div>
      </div>
    </div>
  );
}
