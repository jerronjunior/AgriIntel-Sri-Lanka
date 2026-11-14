import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Platform" };

const FEATURES = [
  { id: "climate", name: "Climate intelligence", inputs: "NASA POWER daily (MERRA-2 meteorology, CERES solar) and 2001–2020 climatology", outputs: ["Temperature and rainfall trends", "Rainfall anomaly against the long-term normal", "Dry-day and heavy-rain (≥50 mm) counts", "Climate risk index with its components"], limits: "Point values represent a ~50 km grid cell. Historical observations are never shown as forecasts." },
  { id: "soil", name: "Soil and water intelligence", inputs: "MERRA-2 surface and root-zone soil wetness via NASA POWER; SMAP L3/L4 once Earthdata credentials are configured", outputs: ["Root-zone wetness trend", "Water stress flag", "Seasonal crop water balance and irrigation demand in m³"], limits: "Regional indicators only. Field-level soil moisture needs in-situ sensors." },
  { id: "suitability", name: "Crop suitability", inputs: "Seasonal temperature and rainfall, elevation, irrigation, optional soil wetness", outputs: ["Recommended and second-best crop", "Crops to avoid", "Factor-by-factor scores and the limiting factor", "Plain-language explanation"], limits: "A rules model with indicative crop parameters, editable by administrators. It is not a trained AI model." },
  { id: "yield", name: "Yield forecasting", inputs: "Historical district production, climate and vegetation features", outputs: ["Baseline and gradient-boosted models", "Held-out evaluation before publication", "Prediction intervals"], limits: "No yield forecast is shown until a model has been evaluated on held-out years of real production data." },
  { id: "profit", name: "Profitability analysis", inputs: "Your yield, price and per-hectare costs (seed, fertiliser, labour, irrigation, transport, other)", outputs: ["Revenue, total cost, net profit", "ROI, profit per acre", "Break-even price and yield", "Saved scenarios with their assumptions"], limits: "Results are only as good as the assumptions you enter." },
  { id: "market", name: "Market intelligence", inputs: "CSV imports of official price series with source and date on every row", outputs: ["Price history and seasonal profile", "District comparison", "Volatility for the risk engine"], limits: "AgriIntel never invents prices and doesn't scrape restricted sites. Price forecasts stay off until a model is validated." },
  { id: "risk", name: "Agricultural risk", inputs: "Rainfall anomaly, heat, heavy rain, suitability, water stress, price volatility", outputs: ["Climate, production and market risk", "Overall index with configurable weights", "Missing components reported, never imputed"], limits: "Decision-support estimates, not underwriting or credit decisions." },
];

export default function Platform() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <h1 className="max-w-3xl text-5xl font-semibold">Seven intelligence modules, one honest data trail</h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">Every number in AgriIntel carries its provider, product, resolution and retrieval date. Here is what each module uses, what it gives you and where its limits are.</p>
      <nav className="mt-10 flex flex-wrap gap-2" aria-label="Modules">
        {FEATURES.map((f) => <a key={f.id} href={`#${f.id}`} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:border-cyan hover:text-ink">{f.name}</a>)}
      </nav>
      <div className="mt-14 divide-y divide-line border-y border-line">
        {FEATURES.map((f) => (
          <section id={f.id} key={f.id} className="grid scroll-mt-24 gap-6 py-12 md:grid-cols-[1fr_1.4fr_1fr]">
            <div><h2 className="text-2xl font-semibold">{f.name}</h2><p className="mt-3 text-sm text-muted">{f.inputs}</p></div>
            <ul className="space-y-2">{f.outputs.map((o) => <li key={o} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" />{o}</li>)}</ul>
            <p className="rounded-xl border border-amber/30 bg-amber/5 p-4 text-sm"><span className="font-semibold text-amber">Limits. </span>{f.limits}</p>
          </section>
        ))}
      </div>
      <div className="mt-14 flex gap-3"><Link href="/register" className="btn btn-primary">Start a free trial</Link><Link href="/contact?kind=demo" className="btn btn-ghost">Request a demo</Link></div>
    </div>
  );
}
