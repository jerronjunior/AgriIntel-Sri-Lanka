import Link from "next/link";
import Explorer from "@/components/agrisphere/Explorer";

const QUESTIONS = [
  "What should be cultivated?", "Where should it be cultivated?", "When should cultivation begin?", "How much area should be allocated?",
  "How much water will be required?", "What is the expected yield?", "What is the expected profit?", "What is the climate risk?",
  "What is the lending risk?", "What is the insurance risk?", "What will market demand look like at harvest?", "Which districts will have oversupply?",
  "Which crops will generate the highest ROI?",
];

type Status = "Connected" | "CSV import" | "Planned";
const EO: [string, string, string, string][] = [
  ["NASA POWER", "Yes", "32.5%", "Temperature, humidity, sunshine, and normal Maha/Yala rainfall"],
  ["SMAP", "Yes", "20%", "Root-zone and surface soil moisture, plus water stress"],
  ["MODIS", "Yes", "15%", "Vegetation greenness (NDVI) compared with past years"],
  ["ECOSTRESS", "Yes", "12.5%", "Land-surface temperature, heat stress, and evapotranspiration"],
  ["GPM IMERG", "Yes", "10%", "30-day rainfall, difference from normal, and heavy-rain days"],
  ["SRTM", "Yes", "10%", "Elevation and how hilly the land is"],
  ["Landsat", "Yes, for farms", "0% of district scores", "Farm-level greenness (NDVI) at 30 m for supplied farm boundaries"],
];
const LK: [string, string, Status][] = [
  ["Department of Agriculture", "Crop calendars, crop suitability, crop forecasts, agro-met advisories", "Planned"],
  ["DOA API Gateway", "Crop details, cultivation data, geographic data, CropLook", "Planned"],
  ["Department of Meteorology", "Rainfall, temperature, climate data, weather forecasts", "Planned"],
  ["Department of Agrarian Development", "Market prices, crop damage reports", "CSV import"],
  ["Central Bank of Sri Lanka", "Farmgate prices, production data, commodity statistics", "CSV import"],
  ["Sri Lanka Open Data Portal", "Crop forecasts, agricultural statistics", "Planned"],
];
const STATUS_CLS: Record<Status, string> = {
  Connected: "border-emerald/50 text-emerald", "CSV import": "border-amber/50 text-amber", Planned: "border-line text-muted",
};

const MODULES: [string, string][] = [
  ["National climate intelligence", "District climate score, monthly drought risk, 7-day flood outlook"],
  ["Water intelligence", "Water Availability Index and irrigation requirement per crop"],
  ["Soil intelligence", "Soil group, suitable crops and soil health indicators"],
  ["Crop suitability", "Ranked crops, crops to avoid and a diversification plan for your land"],
  ["Yield forecasting", "Best, expected and worst case yields"],
  ["Profitability", "Revenue, cost, profit and ROI per crop"],
  ["Market intelligence", "Demand score, saturation risk and harvest-window price outlook"],
  ["Export intelligence", "Supply forecast, export quality and opportunity by product"],
  ["Insurance intelligence", "Flood, drought and yield-volatility risk, plus claims-validation evidence"],
  ["Lending intelligence", "Agricultural credit risk across location, crop, climate, market and yield"],
  ["AI agricultural copilot", "Ask in plain language: what should I cultivate in Polonnaruwa for Yala?"],
];

function Badge({ s }: { s: Status }) {
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLS[s]}`}>{s}</span>;
}

export default function AgriSphereSection() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-5 pb-10 pt-16">
        <p className="text-sm text-cyan">AgriSphere Intelligence Platform</p>
        <h1 className="mt-3 max-w-4xl text-[clamp(2.4rem,5vw,4.4rem)] font-semibold">Decide what to grow, where, when and how much.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">AgriSphere turns Earth observation, climate, water, market, financial and policy data into one decision package for every district of Sri Lanka.</p>
        <ul className="mt-8 grid max-w-5xl gap-x-8 gap-y-1.5 text-sm text-muted sm:grid-cols-2 lg:grid-cols-3">
          {QUESTIONS.map((q) => <li key={q} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald" />{q}</li>)}
        </ul>
      </section>

      <section id="explore" className="mx-auto max-w-[1500px] px-5 pb-24">
        <Explorer mode="demo" />
      </section>

      <section className="border-y border-line bg-navy">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <h2 className="text-4xl font-semibold">Two data layers, one answer</h2>
          <p className="mt-3 max-w-2xl text-muted">Earth observation signals are combined into each district&apos;s opportunity score. Farm-level Landsat adds detail for boundaries you supply.</p>
          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            {([["Earth observation layer", EO], ["Sri Lankan agricultural intelligence layer", LK]] as const).map(([title, rows]) => (
              <div key={title}>
                <h3 className="text-xl font-semibold">{title}</h3>
                {title === "Earth observation layer" ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-cyan/20 bg-panel shadow-[0_18px_50px_rgba(47,92,48,0.14)]">
                    <div className="grid grid-cols-[1.05fr_.8fr_.75fr] gap-3 border-b border-line px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan/80 sm:grid-cols-[1fr_.8fr_.7fr_1.7fr]">
                      <span>NASA data</span><span>Used</span><span>Share</span><span className="hidden sm:block">What it&apos;s used for</span>
                    </div>
                    <ul className="divide-y divide-line">
                      {(rows as [string, string, string, string][]).map(([name, used, share, purpose]) => (
                        <li key={name} className="grid grid-cols-[1.05fr_.8fr_.75fr] gap-3 px-4 py-4 sm:grid-cols-[1fr_.8fr_.7fr_1.7fr]">
                          <div>
                            <span className="font-semibold text-ink">{name}</span>
                            <div className="mt-2 h-1.5 w-full max-w-[110px] overflow-hidden rounded-full bg-line/30">
                              <span className="block h-full rounded-full bg-gradient-to-r from-cyan to-emerald" style={{ width: share.startsWith("0") ? "8%" : share }} />
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-emerald">{used}</span>
                          <span className="text-sm font-semibold text-cyan">{share}</span>
                          <span className="col-span-3 text-xs leading-relaxed text-muted sm:col-span-1 sm:text-sm">{purpose}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-cyan/20 bg-cyan/5 px-4 py-3 text-sm font-bold">
                      <span className="text-ink">Total district-score contribution</span>
                      <span className="text-cyan">100%</span>
                    </div>
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-line border-y border-line">
                    {(rows as [string, string, Status][]).map(([n, d, s]) => (
                      <li key={n} className="flex items-start justify-between gap-4 py-3">
                        <span><span className="font-medium">{n}</span><span className="block text-sm text-muted">{d}</span></span><Badge s={s} />
                      </li>))}
                  </ul>
                )}
              </div>))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <h2 className="text-4xl font-semibold">Eleven intelligence modules</h2>
        <ul className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(([n, d]) => <li key={n} className="border-t border-line pt-4"><h3 className="font-semibold">{n}</h3><p className="mt-1 text-sm text-muted">{d}</p></li>)}
        </ul>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <h2 className="text-4xl font-semibold">Built for the organizations that carry agricultural risk</h2>
            <p className="mt-4 text-muted">Commercial agriculture and agribusiness companies, agricultural insurers and banks, and exporters, alongside the Ministry of Agriculture, the Department of Agriculture, the Department of Agrarian Development and development partners such as FAO, IFAD, UNDP and the World Bank.</p>
          </div>
          <div className="flex flex-col justify-center gap-3 md:items-end">
            <Link href="/contact?kind=demo" className="btn btn-primary">Request a demo with your districts</Link>
            <Link href="/register" className="btn btn-ghost">Start a free trial</Link>
          </div>
        </div>
      </section>
    </>
  );
}
