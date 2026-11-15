"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CloudRain, Droplets, Landmark, LineChart, Shield, Sprout, Tractor, TrendingUp, Building2, Wheat,
  Sparkles, ArrowRight, ArrowUpRight, Radio, Satellite, Layers, ShieldCheck, Award, AlertOctagon,
  CheckCircle2, Play, Plus, Minus, Compass, Cpu, HelpCircle
} from "lucide-react";
import { DataTag } from "@/components/ui/kit";
import { api } from "@/lib/api";
import ExperienceSection from "@/components/marketing/ExperienceSection";
import AgriSphereSection from "@/components/agrisphere/AgriSphereSection";

const FEED_LABEL: Record<string, string> = {
  nasa_power_daily: "NASA POWER Daily Weather",
  nasa_power_climatology: "NASA POWER Climate Normals",
  nasa_power_soil_wetness: "MERRA-2 Soil Wetness",
  gpm_imerg_final: "GPM IMERG Rainfall",
  smap_l3_enhanced: "SMAP Soil Moisture",
  smap_l4_rootzone: "SMAP Root-Zone Moisture",
  sentinel2_l2a: "Sentinel-2 Vegetation",
};

type Source = {
  key: string;
  provider: string;
  product: string;
  spatial_resolution: string;
  status: string;
  last_success_at: string | null;
};

function SourceStatus() {
  const q = useQuery({
    queryKey: ["sources"],
    queryFn: () => api<{ items: Source[] }>("/data-sources", { auth: false, org: false }),
  });
  const dot = (s: string) =>
    s === "operational" ? "bg-cyan shadow-[0_0_8px_rgba(22,143,196,0.45)]" : s === "degraded" ? "bg-amber" : "bg-slate/50";

  return (
    <div className="glass-transmission w-full max-w-[19rem] rounded-2xl p-4.5 text-sm shadow-2xl border-line/60 bg-panel/70">
      <div className="flex items-center justify-between mb-3 border-b border-line/60 pb-2.5">
        <div className="flex items-center gap-2">
          <Satellite className="h-4 w-4 text-cyan" />
          <p className="font-semibold text-xs uppercase tracking-wider text-snow">Observation Feeds</p>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-mono text-cyan">
          <Radio className="h-3 w-3 animate-pulse" />
          LIVE
        </span>
      </div>

      {q.isLoading && <div className="skeleton h-32" />}
      {q.isError && <p className="text-xs text-muted">API offline; live telemetry paused.</p>}

      <ul className="space-y-2.5">
        {q.data?.items
          .filter((s) => s.key !== "smap_l4_rootzone")
          .map((s) => (
            <li key={s.key} className="flex items-start gap-2.5">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot(s.status)}`} aria-hidden />
              <div className="flex-1 leading-snug">
                <span className="text-xs font-semibold text-snow">{FEED_LABEL[s.key] ?? s.product}</span>
                <span className="block text-[11px] font-mono text-muted">
                  {s.spatial_resolution} · {s.status.replace("_", " ")}
                </span>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}

const STEPS = [
  {
    step: "01",
    name: "Automated Ingestion",
    body: "Daily NASA POWER, GPM IMERG and SMAP datasets are retrieved via resilient microservices with automated retries and provenance hashing.",
  },
  {
    step: "02",
    name: "Geospatial Normalization",
    body: "Raw scientific rasters are mapped to 25 official Sri Lankan administrative boundaries, preserving observation dates and data gaps.",
  },
  {
    step: "03",
    name: "Algorithmic Modeling",
    body: "Transparent agronomic suitability models, soil water depletion tracking and portfolio exposure risk calculations are computed on-demand.",
  },
  {
    step: "04",
    name: "Operational Delivery",
    body: "Interactive WebGL visualizers, district drill-downs and auditable PDF exports empower farm managers, underwriters and credit officers.",
  },
];

const DEMO = [
  { crop: "Green gram", profit: 410 },
  { crop: "Sesame", profit: 290 },
  { crop: "Groundnut", profit: 150 },
];

const FAQS = [
  {
    q: "What kind of farming and agricultural solutions do you offer?",
    a: "AgriIntel delivers end-to-end precision agricultural decision support across Sri Lanka: district-level climate stability scores, 5-tier drought vulnerability forecasting, 7-day flood warnings, precision soil water budgets (Green Gram, Cowpea, Chili), and crop suitability rankings calibrated for Maha and Yala seasons."
  },
  {
    q: "How can I start using the AgriIntel platform?",
    a: "You can sign up in seconds for our 14-day free trial or enter our instant offline demo mode directly. Simply select your home district from Sri Lanka's 25 administrative areas to view localized satellite telemetry, or register your farm coordinates for precision field-level advisories."
  },
  {
    q: "Are our recommended agricultural technologies eco-friendly?",
    a: "Yes, 100%. Our intelligence models promote regenerative agriculture, precision drip irrigation, alternate wetting and drying (AWD) for paddy, crop diversification, and organic soil structure enhancement to minimize chemical runoff and preserve groundwater."
  },
  {
    q: "Do you provide localized support and training?",
    a: "Yes. Our platform and exportable advisory reports support English, Sinhala, and Tamil. We partner with agricultural extension officers, farmer organizations, and agronomic advisors to ensure actionable field delivery."
  }
];

type EngineTab = "climate" | "water" | "soil" | "crops" | "yield";

export default function Home() {
  const [activeEngine, setActiveEngine] = useState<EngineTab>("climate");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <>
      {/* Hero Section: Lush Farmer Theme matching Reference Image */}
      <section className="relative pt-24 pb-16 md:pt-28 md:pb-24 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-line/60 bg-[#dff2fc] shadow-[0_30px_90px_rgba(35,91,128,0.18)] min-h-[580px] md:min-h-[640px] flex flex-col justify-between">
            {/* Background Photographic Image of Lush Farm Terraces with Asian Farmer */}
            <div className="absolute inset-0 z-0">
              <img
                src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1800&q=80"
                alt="Lush green agricultural terraces"
                className="h-full w-full object-cover object-center filter brightness-[0.62] contrast-[1.12]"
              />
              {/* Organic Forest Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#dff2fc] via-[#dff2fc]/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#dff2fc]/95 via-[#dff2fc]/60 to-transparent" />
            </div>

            {/* Hero Content Overlay */}
            <div className="relative z-10 p-6 sm:p-12 md:p-16 max-w-3xl">
              {/* Sustaining Earth Pill Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-white/60 px-4 py-1.5 text-xs font-bold text-cyan backdrop-blur-md shadow-[0_0_20px_rgba(22,143,196,0.18)] mb-6">
                <span className="h-2 w-2 rounded-full bg-cyan radar-ring" />
                <span>Sustaining Earth · Sri Lankan Agriculture</span>
              </div>

              {/* Headline */}
              <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-snow leading-[1.04]">
                Grow the Future with{" "}
                <span className="text-cyan block mt-1">Sustainable Agriculture</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-6 max-w-xl text-base sm:text-lg text-snow/80 leading-relaxed font-sans">
                We empower farmers with eco-friendly methods, modern tools, and a shared intent to nourish the planet, naturally and responsibly.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/app/farms" className="btn-farmer !py-2.5 !pl-6 !pr-2 !text-sm">
                  <span>Explore Our Farms</span>
                  <span className="btn-farmer-circle !h-9 !w-9">
                    <ArrowRight className="h-4 w-4 text-snow" />
                  </span>
                </Link>

                <Link
                  href="/register"
                  className="rounded-full border border-snow/30 bg-black/40 px-6 py-3.5 text-sm font-bold text-snow backdrop-blur-md transition-all hover:border-cyan hover:text-cyan hover:bg-black/60 shadow-lg"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>
            </div>

            {/* Bottom Partner Trust Ribbon (matching bottom of reference hero) */}
            <div className="relative z-10 border-t border-line/40 bg-white/70 backdrop-blur-xl px-6 py-4 sm:px-12">
              <div className="flex flex-wrap items-center justify-between gap-6 text-xs font-mono text-snow/60">
                <span className="flex items-center gap-2 text-cyan font-bold uppercase tracking-wider text-[11px]">
                  <Satellite className="h-3.5 w-3.5" /> Earth Observation Stack:
                </span>
                <span className="hover:text-snow transition-colors">NASA POWER Climatology</span>
                <span className="hover:text-snow transition-colors">Sentinel-2 Multispectral</span>
                <span className="hover:text-snow transition-colors">GPM IMERG Precipitation</span>
                <span className="hover:text-snow transition-colors">SMAP Soil Hydrology</span>
                <span className="hover:text-snow transition-colors">DOA Experimental Census</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: INNOVATING THE FUTURE OF AGRICULTURE (Matching Reference Image) */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-2 items-start mb-12">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-snow leading-tight">
              Innovating the Future <br className="hidden sm:inline" />
              of Agriculture
            </h2>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan radar-ring" />
            <p className="text-sm sm:text-base text-muted leading-relaxed">
              AgriIntel combines modern technology and sustainable practices to help farmers grow smarter crops, preserve vital groundwater, and achieve superior harvest yields across Sri Lanka’s 25 agro-ecological zones.
            </p>
          </div>
        </div>

        {/* 2 Visual Story Cards + 3 Statistics Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch">
          {/* Visual Card 1: Green Tea / Crop Rows */}
          <div className="group relative overflow-hidden rounded-3xl border border-line/60 bg-panel/60 shadow-xl h-80 card-3d">
            <img
              src="https://images.unsplash.com/photo-1586771107445-d3ca888129ff?auto=format&fit=crop&w=800&q=80"
              alt="Lush green tea plantation rows"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 filter brightness-[0.75]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#dff2fc] via-[#dff2fc]/20 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <span className="rounded-full bg-cyan/20 border border-cyan/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-cyan backdrop-blur-md">
                Dry & Wet Zones
              </span>
              <p className="mt-2 text-sm font-bold text-snow">Precision Agro-Ecological Profiling</p>
            </div>
          </div>

          {/* Visual Card 2: Farmer Inspecting Crops */}
          <div className="group relative overflow-hidden rounded-3xl border border-line/60 bg-panel/60 shadow-xl h-80 card-3d">
            <img
              src="https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80"
              alt="Farmer inspecting crop plant"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 filter brightness-[0.75]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#dff2fc] via-[#dff2fc]/20 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <span className="rounded-full bg-emerald/20 border border-emerald/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald backdrop-blur-md">
                Soil Health
              </span>
              <p className="mt-2 text-sm font-bold text-snow">Regenerative Root Aeration</p>
            </div>
          </div>

          {/* Statistics Column (Matching Reference Image) */}
          <div className="lg:col-span-2 flex flex-col justify-between gap-4">
            <div className="rounded-3xl border border-line/60 bg-panel/60 p-6 backdrop-blur-md flex-1 flex flex-col justify-center">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl sm:text-5xl font-black text-cyan">100%</span>
                <span className="text-sm font-bold text-snow">Customer Satisfaction</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Proven satisfaction with local farming communities, commercial estates, and agronomic cooperatives.
              </p>
            </div>

            <div className="rounded-3xl border border-line/60 bg-panel/60 p-6 backdrop-blur-md flex-1 flex flex-col justify-center">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl sm:text-5xl font-black text-emerald">20+</span>
                <span className="text-sm font-bold text-snow">Years of Climate Data</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Decades of continuous satellite reanalysis tracking Sri Lankan solar radiation, rainfall normal and GDD.
              </p>
            </div>

            <div className="rounded-3xl border border-line/60 bg-panel/60 p-6 backdrop-blur-md flex-1 flex flex-col justify-center">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl sm:text-5xl font-black text-snow">100%</span>
                <span className="text-sm font-bold text-cyan">Sustainable Growth</span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Maximizing crop yields while saving up to 42% irrigation water and eliminating excessive chemical fertilizer runoff.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: WHERE TECHNOLOGY MEETS THE ROOTS OF NATURE (Matching Reference Image) */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 border-t border-line/40">
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan flex items-center gap-2">
            <Cpu className="h-4 w-4" /> Precision Agronomy
          </span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-snow">
            Where Technology Meets <br />
            the Roots of Nature
          </h2>
        </div>

        {/* Feature Hero Card with Circular Play / Telemetry Button */}
        <div className="group relative overflow-hidden rounded-[2.5rem] border border-cyan/40 bg-panel shadow-2xl h-96 sm:h-[450px] mb-8 card-3d">
          <img
            src="https://images.unsplash.com/photo-1527842891421-42eec6e703ea?auto=format&fit=crop&w=1600&q=80"
            alt="Drone aerial view of green terraced rice paddy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 filter brightness-[0.7]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#dff2fc] via-transparent to-[#dff2fc]/40" />
          
          {/* Centered Circular Glass Play / Telemetry Button (just like in the image) */}
          <div className="absolute inset-0 grid place-items-center">
            <Link
              href="/app/simulator"
              className="group/btn relative grid h-20 w-20 place-items-center rounded-full border border-cyan/60 bg-black/50 backdrop-blur-xl shadow-[0_0_35px_rgba(210,248,67,0.4)] transition-all hover:scale-110 hover:bg-cyan hover:border-cyan"
            >
              <Play className="h-8 w-8 text-cyan fill-cyan transition-colors group-hover/btn:text-night group-hover/btn:fill-night ml-1" />
              <span className="absolute -inset-2 rounded-full border border-cyan/40 animate-ping pointer-events-none" />
            </Link>
          </div>

          <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="rounded-full bg-cyan/20 border border-cyan/40 px-3 py-1 text-xs font-bold text-cyan backdrop-blur-md">
                Satellite & Drone Telemetry
              </span>
              <h3 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-snow">
                Interactive Agro-Spatial Decision Simulator
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-snow/80 max-w-xl">
                Simulate rainfall anomalies, evaluate multi-layer soil hydrology, and predict harvest profits before planting.
              </p>
            </div>
            <Link href="/app/simulator" className="btn-farmer !py-2 !px-4 !text-xs">
              <span>Launch Simulator</span>
              <span className="btn-farmer-circle !h-6 !w-6">
                <ArrowRight className="h-3 w-3 text-snow" />
              </span>
            </Link>
          </div>
        </div>

        {/* 4 Story & Tech Cards (Matching the 4 cards in Reference Image) */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Sustainable Farming in Climate Change",
              category: "Climate Resilient",
              desc: "Hyper-local dry spell and drought forecasting protecting Maha and Yala harvests against extreme heat stress.",
              img: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=800&q=80",
              link: "/app/climate",
            },
            {
              title: "Satellite & Drone Telemetry in Farming",
              category: "Telemetry",
              desc: "Multispectral Sentinel-2 NDVI canopy index tracking crop vigor, nitrogen assimilation, and pest damage.",
              img: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=800&q=80",
              link: "/app/crops",
            },
            {
              title: "Regenerative Water Management",
              category: "Water Intelligence",
              desc: "Precision drip irrigation scheduling and AWD water savings up to 45% for high-value pulses and legumes.",
              img: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80",
              link: "/app/water",
            },
            {
              title: "Multi-Layer Soil Health Systems",
              category: "Soil Physics",
              desc: "Pedological physics modeling for Reddish Brown Earths, bulk compaction density, and water retention capacity.",
              img: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80",
              link: "/app/soil",
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.link}
              className="group card-3d overflow-hidden rounded-3xl border border-line/60 bg-panel/60 p-4 transition-all hover:border-cyan/50 backdrop-blur-md flex flex-col justify-between"
            >
              <div>
                <div className="relative h-44 w-full overflow-hidden rounded-2xl mb-4">
                  <img
                    src={item.img}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 filter brightness-[0.8]"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-cyan px-2.5 py-0.5 text-[10px] font-bold text-night">
                    {item.category}
                  </span>
                </div>
                <h4 className="font-bold text-snow text-sm group-hover:text-cyan transition-colors">
                  {item.title}
                </h4>
                <p className="mt-2 text-xs text-muted leading-relaxed">
                  {item.desc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-line/40 flex items-center justify-between text-xs font-semibold text-cyan">
                <span>View Intelligence</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Section 4: Real-time Operational Engines (All 5 Modules Tabs) */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="card-3d glass-transmission rounded-[2.5rem] border border-cyan/40 bg-gradient-to-br from-[#e7f7fe] via-[#dff2fc] to-[#cfeaf8] p-6 sm:p-10 shadow-[0_25px_60px_rgba(35,91,128,0.16)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1 text-xs font-semibold text-cyan">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Next-Gen Operational Engines</span>
              </div>
              <h2 className="mt-3 font-display text-3xl font-extrabold text-snow md:text-4xl">
                Real-Time Earth Observation Engines
              </h2>
              <p className="mt-1 text-sm text-muted">
                Synthesizing multi-satellite telemetry across Sri Lanka’s 25 agro-ecological zones
              </p>
            </div>

            {/* Engine Tabs */}
            <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line/60 bg-base/80 p-1.5 shadow-inner">
              <button
                onClick={() => setActiveEngine("climate")}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeEngine === "climate"
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(210,248,67,0.45)]"
                    : "text-muted hover:text-snow"
                }`}
              >
                <CloudRain className="h-3.5 w-3.5" />
                <span>M1: Climate</span>
              </button>
              <button
                onClick={() => setActiveEngine("water")}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeEngine === "water"
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(210,248,67,0.45)]"
                    : "text-muted hover:text-snow"
                }`}
              >
                <Droplets className="h-3.5 w-3.5" />
                <span>M2: Water</span>
              </button>
              <button
                onClick={() => setActiveEngine("soil")}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeEngine === "soil"
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(210,248,67,0.45)]"
                    : "text-muted hover:text-snow"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>M3: Soil</span>
              </button>
              <button
                onClick={() => setActiveEngine("crops")}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeEngine === "crops"
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(210,248,67,0.45)]"
                    : "text-muted hover:text-snow"
                }`}
              >
                <Sprout className="h-3.5 w-3.5" />
                <span>M4: Crop Suitability</span>
              </button>
              <button
                onClick={() => setActiveEngine("yield")}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  activeEngine === "yield"
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(210,248,67,0.45)]"
                    : "text-muted hover:text-snow"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>M5: Yield Forecast</span>
              </button>
            </div>
          </div>

          {/* Engine Content */}
          <div className="mt-8">
            {activeEngine === "climate" && (
              <div className="space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-snow">District Climate Score: Anuradhapura</h3>
                    <p className="text-xs text-muted">Zone: Dry Zone · North Central Province</p>
                  </div>
                  <span className="rounded-full border border-amber/40 bg-amber/15 px-3 py-1 text-xs font-bold text-amber">
                    High Heat Stress · Moderate Water Security
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-2xl border border-line/60 bg-panel/60 p-4">
                    <span className="text-xs font-semibold uppercase text-muted">Climate Stability</span>
                    <p className="mt-2 text-3xl font-extrabold text-snow">68%</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-base overflow-hidden">
                      <div className="h-full bg-cyan rounded-full" style={{ width: "68%" }} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line/60 bg-panel/60 p-4">
                    <span className="text-xs font-semibold uppercase text-muted">Rainfall Deviation</span>
                    <p className="mt-2 text-3xl font-extrabold text-amber">-12%</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-base overflow-hidden">
                      <div className="h-full bg-amber rounded-full" style={{ width: "48%" }} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line/60 bg-panel/60 p-4">
                    <span className="text-xs font-semibold uppercase text-muted">Heat Stress</span>
                    <p className="mt-2 text-3xl font-extrabold text-rose">High</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-base overflow-hidden">
                      <div className="h-full bg-rose rounded-full" style={{ width: "75%" }} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line/60 bg-panel/60 p-4">
                    <span className="text-xs font-semibold uppercase text-muted">Water Security</span>
                    <p className="mt-2 text-3xl font-extrabold text-emerald">Moderate</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-base overflow-hidden">
                      <div className="h-full bg-emerald rounded-full" style={{ width: "60%" }} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-2xl border border-line/60 bg-panel/40 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-snow text-sm">Monthly Drought Risk</h4>
                      <span className="text-[11px] font-mono text-muted">5 Risk Tiers</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
                      <span className="rounded px-2 py-0.5 bg-emerald/15 text-emerald border border-emerald/30 font-medium">Very Low</span>
                      <span className="rounded px-2 py-0.5 bg-cyan/15 text-cyan border border-cyan/30 font-medium">Low</span>
                      <span className="rounded px-2 py-0.5 bg-amber/15 text-amber border border-amber/30 font-medium">Moderate</span>
                      <span className="rounded px-2 py-0.5 bg-rose/15 text-rose border border-rose/30 font-medium">High</span>
                      <span className="rounded px-2 py-0.5 bg-red-950 text-red-400 border border-red-500/50 font-bold">Critical</span>
                    </div>
                    <p className="text-xs text-muted">
                      Peak dry spells modeled for July–August (Critical: 88%) and February (High: 74%), with monsoon recovery during Maha (Very Low).
                    </p>
                  </div>

                  <div className="rounded-2xl border border-line/60 bg-panel/40 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-snow text-sm">Flood Risk Forecast (Next 7 Days)</h4>
                      <span className="rounded-full bg-emerald/20 px-2 py-0.5 text-[10px] font-bold text-emerald border border-emerald/30">
                        Low Probability
                      </span>
                    </div>
                    <p className="text-xs text-muted mb-3">
                      Expected 7-day cumulative precip: 42.4 mm. Zero flash flood alerts across Anuradhapura tanks and river basins.
                    </p>
                    <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px]">
                      {["D1", "D2", "D3", "D4", "D5", "D6", "D7"].map((d, i) => (
                        <div key={d} className="rounded bg-base/80 p-1.5 border border-line/40">
                          <span className="text-muted block">{d}</span>
                          <span className="text-cyan font-bold block mt-0.5">{[3.5, 5.2, 18.4, 7.1, 2.0, 4.4, 1.8][i]}mm</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-right">
                  <Link href="/app/climate" className="text-xs font-semibold text-cyan hover:underline inline-flex items-center gap-1">
                    <span>Open full National Climate Intelligence Console</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {activeEngine === "water" && (
              <div className="space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-snow">Water Intelligence Engine</h3>
                    <p className="text-xs text-muted">Hydrological Availability & Precision Crop Demand</p>
                  </div>
                  <span className="rounded-full border border-cyan/40 bg-cyan/15 px-3 py-1 text-xs font-bold text-cyan">
                    Water Availability Index: 64.2 / 100 (Optimal)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    { n: "Reservoir Support", v: "74%", s: "High", c: "text-emerald" },
                    { n: "Groundwater Availability", v: "62%", s: "Moderate", c: "text-cyan" },
                    { n: "Rainfall Potential", v: "48%", s: "Moderate", c: "text-amber" },
                    { n: "Soil Water Retention", v: "66%", s: "Moderate", c: "text-cyan" },
                  ].map((p) => (
                    <div key={p.n} className="rounded-2xl border border-line/60 bg-panel/60 p-4">
                      <span className="text-xs font-semibold uppercase text-muted">{p.n}</span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-snow">{p.v}</span>
                        <span className={`text-xs font-bold ${p.c}`}>{p.s}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-2xl border border-line/60 bg-panel/40">
                  <div className="px-5 py-3 border-b border-line/60 bg-panel/80 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-snow">
                      Crop Irrigation Requirement (mm)
                    </span>
                    <span className="text-[11px] font-mono text-cyan">Precision Drip / AWD Benchmark</span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line/40 text-muted font-mono uppercase">
                      <tr>
                        <th className="px-5 py-3">Crop</th>
                        <th className="px-5 py-3">Water Required</th>
                        <th className="px-5 py-3">Recommended Method</th>
                        <th className="px-5 py-3 text-right">Water Savings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/30 font-sans">
                      {[
                        { crop: "Green Gram", req: "320 mm", method: "Drip / Furrow", save: "+38%" },
                        { crop: "Cowpea", req: "280 mm", method: "Drip Irrigation", save: "+42%" },
                        { crop: "Chili", req: "520 mm", method: "Drip with Fertigation", save: "+45%" },
                        { crop: "Maize", req: "480 mm", method: "Sprinkler / Furrow", save: "+32%" },
                        { crop: "Paddy (Maha)", req: "1,150 mm", method: "Alternate Wetting & Drying", save: "+30%" },
                      ].map((c) => (
                        <tr key={c.crop} className="hover:bg-panel/60">
                          <td className="px-5 py-3 font-semibold text-snow">{c.crop}</td>
                          <td className="px-5 py-3 font-display text-sm font-extrabold text-cyan">{c.req}</td>
                          <td className="px-5 py-3 text-muted">{c.method}</td>
                          <td className="px-5 py-3 text-right font-mono font-bold text-emerald">{c.save}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 text-right">
                  <Link href="/app/water" className="text-xs font-semibold text-cyan hover:underline inline-flex items-center gap-1">
                    <span>Open full Water Intelligence Engine Console</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {activeEngine === "soil" && (
              <div className="space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-snow">Soil Intelligence Engine</h3>
                    <p className="text-xs text-muted">Pedological Suitability & Multi-layer Soil Physics</p>
                  </div>
                  <span className="rounded-full border border-emerald/40 bg-emerald/15 px-3 py-1 text-xs font-bold text-emerald">
                    Location: Monaragala · Soil Type: Reddish Brown Earth
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan mb-3">Suitable Crops (Monaragala · Reddish Brown Earth)</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { crop: "Groundnut", score: "92%", note: "Excellent root zone aeration & calcium binding", rank: "Top Match" },
                      { crop: "Sesame", score: "89%", note: "Deep taproot drought tolerance in sandy clay loam", rank: "High" },
                      { crop: "Green Gram", score: "85%", note: "Fast nodulation with high phosphorus response", rank: "High" },
                    ].map((sc) => (
                      <div key={sc.crop} className="card-3d rounded-2xl border border-line/60 bg-panel/60 p-5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-snow">{sc.crop}</span>
                          <span className="rounded-full bg-emerald/20 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald border border-emerald/30">
                            {sc.score}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted leading-relaxed">{sc.note}</p>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-base overflow-hidden">
                          <div className="h-full bg-emerald rounded-full" style={{ width: sc.score }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Soil Health Indicators</h4>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {[
                      { name: "Drainage", value: "78%", status: "Good", desc: "Moderate hydraulic permeability", col: "text-emerald" },
                      { name: "Compaction Risk", value: "22%", status: "Low", desc: "Minimal subsoil hardpan", col: "text-cyan" },
                      { name: "Erosion Risk", value: "45%", status: "Moderate", desc: "Slope stabilization advised", col: "text-amber" },
                      { name: "Water Holding Capacity", value: "81%", status: "High", desc: "Optimal retention for Yala legumes", col: "text-emerald" },
                    ].map((sh) => (
                      <div key={sh.name} className="rounded-2xl border border-line/60 bg-panel/60 p-4">
                        <span className="text-xs font-semibold uppercase text-muted">{sh.name}</span>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-2xl font-extrabold text-snow">{sh.value}</span>
                          <span className={`text-xs font-bold ${sh.col}`}>{sh.status}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted">{sh.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 text-right">
                  <Link href="/app/soil" className="text-xs font-semibold text-cyan hover:underline inline-flex items-center gap-1">
                    <span>Open full Soil Intelligence Engine Console</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {activeEngine === "crops" && (
              <div className="space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-snow">Crop Suitability Intelligence</h3>
                    <p className="text-xs text-muted">Agronomic Optimization Engine · Hambantota · Yala Season</p>
                  </div>
                  <span className="rounded-full border border-cyan/40 bg-cyan/15 px-3 py-1 text-xs font-bold text-cyan">
                    Hambantota · Yala Season
                  </span>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-2xl border border-line/60 bg-panel/40 p-5">
                    <div className="flex items-center justify-between mb-3 border-b border-line/60 pb-2">
                      <h4 className="font-bold text-snow text-sm">Best Crop Recommendation</h4>
                      <span className="text-[11px] font-mono text-cyan">Ranked Hierarchy</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { rank: 1, crop: "Groundnut", score: "94/100", tag: "Highest Margin" },
                        { rank: 2, crop: "Sesame", score: "91/100", tag: "Drought Resilient" },
                        { rank: 3, crop: "Cowpea", score: "88/100", tag: "Fast Maturing" },
                        { rank: 4, crop: "Green Gram", score: "86/100", tag: "Soil Nitrogen Enriched" },
                      ].map((r) => (
                        <div key={r.rank} className="flex items-center justify-between rounded-xl bg-panel/80 p-2.5 border border-line/40">
                          <div className="flex items-center gap-3">
                            <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan/20 text-xs font-black text-cyan">
                              {r.rank}
                            </span>
                            <span className="font-semibold text-snow text-xs">{r.crop}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted">{r.tag}</span>
                            <span className="font-mono text-xs font-bold text-emerald">{r.score}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-rose/30 bg-rose/10 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose">
                        <AlertOctagon className="h-4 w-4 shrink-0" />
                        <span>Avoid: Big Onion</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        High water requirement (430 mm) under Yala dry-spell deficit creates 64% crop failure probability.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line/60 bg-panel/40 p-5">
                    <div className="flex items-center justify-between mb-3 border-b border-line/60 pb-2">
                      <h4 className="font-bold text-snow text-sm">Crop Diversification Recommendation</h4>
                      <span className="text-[11px] font-mono text-emerald">Land: 100 Hectares</span>
                    </div>
                    <div className="space-y-2.5">
                      {[
                        { crop: "Groundnut", pct: "40%", ha: "40 Hectares", color: "bg-emerald", textCol: "text-emerald" },
                        { crop: "Sesame", pct: "25%", ha: "25 Hectares", color: "bg-cyan", textCol: "text-cyan" },
                        { crop: "Cowpea", pct: "20%", ha: "20 Hectares", color: "bg-violet", textCol: "text-violet" },
                        { crop: "Chili", pct: "15%", ha: "15 Hectares", color: "bg-amber", textCol: "text-amber" },
                      ].map((d) => (
                        <div key={d.crop}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-snow">{d.crop}</span>
                            <span className={`font-mono font-bold ${d.textCol}`}>{d.pct} ({d.ha})</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-base overflow-hidden">
                            <div className={`h-full ${d.color} rounded-full`} style={{ width: d.pct }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-line/40 bg-base/60 p-3 text-xs text-muted">
                      Optimizes farm income stability against drought while maintaining 38% aggregate water savings over monoculture.
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-right">
                  <Link href="/app/crops" className="text-xs font-semibold text-cyan hover:underline inline-flex items-center gap-1">
                    <span>Open full Crop Suitability Intelligence Console</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {activeEngine === "yield" && (
              <div className="space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-snow">Yield Forecasting Engine</h3>
                    <p className="text-xs text-muted">Probabilistic Harvest Projections · Best, Average & Worst Case Scenarios</p>
                  </div>
                  <span className="rounded-full border border-emerald/40 bg-emerald/15 px-3 py-1 text-xs font-bold text-emerald">
                    Calibrated Benchmark Models
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan">
                      Prompt Reference Example: Groundnut Expected Yield
                    </span>
                    <span className="text-xs font-mono text-muted">Metric Tons per Hectare (MT/Ha)</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="card-3d rounded-2xl border border-emerald/40 bg-panel/70 p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald">Best Case</span>
                      <p className="mt-2 text-3xl font-black text-emerald">2.8 MT/Ha</p>
                      <p className="mt-1 text-xs text-muted">Under precision drip & full macro/micro nutrient schedule</p>
                      <div className="mt-3 h-1.5 w-full rounded-full bg-base overflow-hidden">
                        <div className="h-full bg-emerald rounded-full" style={{ width: "95%" }} />
                      </div>
                    </div>

                    <div className="card-3d rounded-2xl border border-cyan/40 bg-panel/70 p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan">Expected Case</span>
                      <p className="mt-2 text-3xl font-black text-snow">2.4 MT/Ha</p>
                      <p className="mt-1 text-xs text-muted">Standard Hambantota Yala conditions with average rainfall</p>
                      <div className="mt-3 h-1.5 w-full rounded-full bg-base overflow-hidden">
                        <div className="h-full bg-cyan rounded-full" style={{ width: "75%" }} />
                      </div>
                    </div>

                    <div className="card-3d rounded-2xl border border-amber/40 bg-panel/70 p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber">Worst Case</span>
                      <p className="mt-2 text-3xl font-black text-amber">1.9 MT/Ha</p>
                      <p className="mt-1 text-xs text-muted">Simulated under dry-spell moisture stress during pod filling</p>
                      <div className="mt-3 h-1.5 w-full rounded-full bg-base overflow-hidden">
                        <div className="h-full bg-amber rounded-full" style={{ width: "50%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-line/60 bg-panel/40">
                  <div className="px-5 py-3 border-b border-line/60 bg-panel/80 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-snow">
                      Multi-Crop Yield Boundaries (MT/Ha)
                    </span>
                    <span className="text-[11px] font-mono text-cyan">DOA Experimental Census</span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line/40 text-muted font-mono uppercase">
                      <tr>
                        <th className="px-5 py-3">Crop</th>
                        <th className="px-5 py-3 text-emerald font-bold">Best Case</th>
                        <th className="px-5 py-3 text-cyan font-bold">Average / Expected</th>
                        <th className="px-5 py-3 text-amber font-bold">Worst Case</th>
                        <th className="px-5 py-3 text-right">Risk Buffer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/30 font-sans">
                      {[
                        { crop: "Groundnut", best: "2.8 MT/Ha", exp: "2.4 MT/Ha", worst: "1.9 MT/Ha", buffer: "20.8%" },
                        { crop: "Sesame", best: "1.2 MT/Ha", exp: "0.95 MT/Ha", worst: "0.7 MT/Ha", buffer: "26.3%" },
                        { crop: "Cowpea", best: "1.8 MT/Ha", exp: "1.5 MT/Ha", worst: "1.1 MT/Ha", buffer: "26.7%" },
                        { crop: "Green Gram", best: "1.6 MT/Ha", exp: "1.35 MT/Ha", worst: "1.0 MT/Ha", buffer: "25.9%" },
                        { crop: "Chili", best: "3.4 MT/Ha", exp: "2.7 MT/Ha", worst: "1.8 MT/Ha", buffer: "33.3%" },
                      ].map((y) => (
                        <tr key={y.crop} className="hover:bg-panel/60">
                          <td className="px-5 py-3 font-semibold text-snow">{y.crop}</td>
                          <td className="px-5 py-3 font-mono font-bold text-emerald">{y.best}</td>
                          <td className="px-5 py-3 font-mono font-bold text-snow">{y.exp}</td>
                          <td className="px-5 py-3 font-mono font-bold text-amber">{y.worst}</td>
                          <td className="px-5 py-3 text-right font-mono text-muted">{y.buffer}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 text-right">
                  <Link href="/app/yield" className="text-xs font-semibold text-cyan hover:underline inline-flex items-center gap-1">
                    <span>Open full Yield Forecasting Engine Console</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 5: Crisp Dark Forest Green & Lime FAQ */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <div className="glass-transmission rounded-[2.5rem] bg-gradient-to-br from-[#0c2417]/95 via-[#081b10]/95 to-[#06160d]/95 text-snow p-8 sm:p-14 shadow-2xl border border-cyan/25">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] items-start">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan">
                <span className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
                Frequently Asked Questions
              </span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-snow">
                Got Questions? <br />
                We’ve Got You Covered.
              </h2>
              <p className="mt-4 text-sm text-[#95af93] leading-relaxed max-w-md">
                Everything you need to know about starting with AgriIntel’s precision agricultural intelligence platform in Sri Lanka.
              </p>
              <div className="mt-8">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-3 rounded-full bg-cyan text-[#07190e] px-6 py-3.5 text-xs font-bold transition-all hover:bg-[#e2fc68] shadow-[0_0_20px_rgba(210,248,67,0.35)]"
                >
                  <span>Ask a Question</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Clean Dark Green Accordion Items */}
            <div className="divide-y divide-line/40">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={faq.q} className="py-5">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between text-left gap-4 font-display font-bold text-base sm:text-lg text-snow hover:text-cyan transition-colors"
                    >
                      <span>{faq.q}</span>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cyan/40 bg-panel-2 text-cyan shadow-[0_0_12px_rgba(210,248,67,0.2)]">
                        {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </button>
                    {isOpen && (
                      <p className="mt-3 text-sm text-[#95af93] leading-relaxed animate-fadeIn">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Decision Simulator Interactive Teaser */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 py-20 md:grid-cols-2 border-t border-line/40">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan">Interactive Modeling</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-snow tracking-tight">The Decision Simulator</h2>
          <p className="mt-4 text-sm text-muted leading-relaxed">
            Test realistic farming scenarios before investing capital. Compare Green Gram, Sesame and Groundnut in Monaragala under a 20% Yala rainfall deficit. AgriIntel synthesizes the NASA POWER climate baseline, adjusts soil water budgets, and calculates estimated yields, revenues, and risk metrics.
          </p>
          <div className="mt-8">
            <Link href="/register" className="btn btn-primary !py-3.5 shadow-lg">
              <span>Run your first scenario</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="glass-transmission rounded-3xl p-7 shadow-2xl border-cyan/30">
          <div className="mb-5 flex items-center justify-between border-b border-line/60 pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Scenario Forecast</p>
              <p className="text-sm font-bold text-snow">Net Profit per Hectare (LKR ’000)</p>
            </div>
            <DataTag kind="demo" />
          </div>

          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={DEMO} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" stroke="#92ab90" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="crop" stroke="#92ab90" fontSize={11} width={90} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(22, 143, 196, 0.08)" }}
                  contentStyle={{
                    background: "rgba(14, 38, 24, 0.95)",
                    border: "1px solid rgba(22, 143, 196, 0.3)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    color: "#f6faf4",
                  }}
                />
                <Bar dataKey="profit" fill="#168fc4" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[11px] text-muted text-center">
            Illustrative output. Tailor parameters to actual farmer input costs and local pricing.
          </p>
        </div>
      </section>

      {/* Industry Verticals */}
      <section className="border-t border-line/60 py-20 bg-[#dff2fc]/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-extrabold text-snow tracking-tight">Built for agricultural risk bearers</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 md:grid-cols-5">
            {[
              { i: Tractor, n: "Commercial Farms" },
              { i: Landmark, n: "Agricultural Banks" },
              { i: Shield, n: "Insurance Underwriters" },
              { i: Wheat, n: "Agribusiness & Exporters" },
              { i: Building2, n: "Government Authorities" },
            ].map(({ i: I, n }) => (
              <Link
                key={n}
                href="/industries"
                className="panel card-3d group p-6 border-line/60 text-center flex flex-col items-center justify-center transition-all"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan/10 border border-cyan/20 group-hover:scale-110 group-hover:border-cyan/50 transition-all">
                  <I className="h-6 w-6 text-cyan" aria-hidden />
                </span>
                <p className="mt-3 text-xs font-bold text-snow group-hover:text-cyan transition-colors">{n}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Action Section */}
      <section className="relative overflow-hidden border-t border-line/60 bg-gradient-to-b from-[#0e2719] to-[#07170e] py-28 text-center">
        <div className="pointer-events-none absolute -left-20 top-0 h-96 w-96 rounded-full bg-cyan/10 blur-[140px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-emerald/10 blur-[140px]" />

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/10 px-3.5 py-1 text-xs font-semibold text-cyan mb-4">
            <Radio className="h-3 w-3 animate-pulse" />
            25 Districts Synchronized
          </span>
          <h2 className="text-4xl font-extrabold text-snow tracking-tight sm:text-5xl">
            Experience the future of agricultural intelligence
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed">
            Register your organization in seconds. Begin monitoring climate risks, crop suitability and soil water balance across Sri Lanka today.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="btn btn-primary !px-7 !py-3.5 shadow-xl">
              <span>Start Free Organization Trial</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="btn btn-ghost !px-7 !py-3.5">
              <span>Schedule Live Walkthrough</span>
            </Link>
          </div>
        </div>
      </section>

      <div id="experience" className="scroll-mt-24">
        <ExperienceSection />
      </div>

      <div id="agrisphere" className="scroll-mt-24">
        <AgriSphereSection />
      </div>
    </>
  );
}
