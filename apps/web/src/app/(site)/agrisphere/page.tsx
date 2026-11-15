import Link from "next/link";
import type { Metadata } from "next";
import Explorer from "@/components/agrisphere/Explorer";

export const metadata: Metadata = {
  title: "AgriSphere Intelligence Platform",
  description: "Agricultural decision intelligence for Sri Lanka: what to grow, where, when and how much, with expected profit, risk, demand and harvest for every district.",
};

const QUESTIONS = [
  "What should be cultivated?", "Where should it be cultivated?", "When should cultivation begin?", "How much area should be allocated?",
  "How much water will be required?", "What is the expected yield?", "What is the expected profit?", "What is the climate risk?",
  "What is the lending risk?", "What is the insurance risk?", "What will market demand look like at harvest?", "Which districts will have oversupply?",
  "Which crops will generate the highest ROI?",
];

type Status = "Connected" | "Not connected" | "CSV import" | "Planned";
const EO: [string, string, Status][] = [
  ["NASA POWER", "Temperature, solar radiation, humidity, wind, rainfall normals", "Connected"],
  ["NASA GPM IMERG", "Rainfall, anomalies, accumulated precipitation", "Not connected"],
  ["NASA SMAP", "Surface and root-zone soil moisture, drought conditions", "Not connected"],
  ["NASA ECOSTRESS", "Evapotranspiration, surface temperature", "Not connected"],
  ["Landsat", "Reflectance, NDVI, historical crop performance", "Not connected"],
  ["MODIS / VIIRS", "Regional vegetation and seasonal crop development", "Not connected"],
  ["Sentinel-2 (EU Copernicus)", "Field-level crop monitoring and vegetation indices", "Not connected"],
  ["NASA GLDAS", "Soil moisture, runoff, drought indicators", "Not connected"],
  ["SRTM", "Elevation, slope, drainage", "Not connected"],
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
  Connected: "border-emerald/50 text-emerald", "Not connected": "border-line text-muted", "CSV import": "border-amber/50 text-amber", Planned: "border-line text-muted",
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

export default function AgriSpherePage() {
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
          <p className="mt-3 max-w-2xl text-muted">Statuses reflect whether each source is connected to live application data. Demo and discovery-only values are not marked as connected.</p>
          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            {([["Earth observation layer", EO], ["Sri Lankan agricultural intelligence layer", LK]] as const).map(([title, rows]) => (
              <div key={title}>
                <h3 className="text-xl font-semibold">{title}</h3>
                <ul className="mt-4 divide-y divide-line border-y border-line">
                  {rows.map(([n, d, s]) => (
                    <li key={n} className="flex items-start justify-between gap-4 py-3">
                      <span><span className="font-medium">{n}</span><span className="block text-sm text-muted">{d}</span></span><Badge s={s} />
                    </li>))}
                </ul>
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
