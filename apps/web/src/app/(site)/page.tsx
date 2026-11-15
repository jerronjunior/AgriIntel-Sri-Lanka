"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CloudRain, Droplets, Landmark, LineChart, Shield, Sprout, Tractor, TrendingUp, Building2, Wheat,
  Sparkles, ArrowRight, Radio, Satellite, Layers, ShieldCheck, Award, AlertOctagon, CheckCircle2, PieChart
} from "lucide-react";
import Globe from "@/components/globe/Globe";
import { DataTag } from "@/components/ui/kit";
import { api } from "@/lib/api";
import type { Plan } from "@/lib/types";

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
    s === "operational" ? "bg-emerald shadow-[0_0_8px_rgba(16,185,129,0.8)]" : s === "degraded" ? "bg-amber" : "bg-slate/50";

  return (
    <div className="glass-transmission w-full max-w-[19rem] rounded-2xl p-4.5 text-sm shadow-2xl border-cyan/30">
      <div className="flex items-center justify-between mb-3 border-b border-line/60 pb-2.5">
        <div className="flex items-center gap-2">
          <Satellite className="h-4 w-4 text-cyan" />
          <p className="font-semibold text-xs uppercase tracking-wider text-snow">Observation Feeds</p>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-mono text-emerald">
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

const MODULES = [
  {
    icon: CloudRain,
    name: "Climate Intelligence",
    body: "Daily temperature, precipitation, humidity, solar radiation & wind across Sri Lanka, bench-marked against 20-year normals.",
    accent: "text-cyan",
  },
  {
    icon: Droplets,
    name: "Soil & Water Balance",
    body: "MERRA-2 root-zone wetness & water stress flags with explicit spatial resolution metrics next to every single observation.",
    accent: "text-emerald",
  },
  {
    icon: Sprout,
    name: "Crop Suitability",
    body: "Transparent rules engine ranking paddy, maize, pulses, chili & onion for Maha/Yala seasons with clear agronomic explanations.",
    accent: "text-lime-400",
  },
  {
    icon: TrendingUp,
    name: "Profitability Forecasts",
    body: "Interactive gross revenue, input costs, net margins, ROI and break-even calculations customized to local farmer parameters.",
    accent: "text-amber",
  },
  {
    icon: LineChart,
    name: "Market Volatility",
    body: "Historical Colombo & district wholesale price indexes, multi-year seasonal comparisons and margin sensitivity alerts.",
    accent: "text-violet",
  },
  {
    icon: Shield,
    name: "Integrated Risk Index",
    body: "Comprehensive composite index synthesizing climate deficit, crop vulnerability and price fluctuations with full mathematical auditability.",
    accent: "text-rose",
  },
];

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

type EngineTab = "climate" | "water" | "soil" | "crops" | "yield";

export default function Home() {
  const [activeEngine, setActiveEngine] = useState<EngineTab>("climate");
  const hero = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => {
      const el = hero.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      progress.current = Math.min(1, Math.max(0, -r.top / (r.height - window.innerHeight)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => api<{ items: Plan[] }>("/subscriptions/plans", { auth: false, org: false }),
  });

  return (
    <>
      {/* Hero Section with 3D Globe */}
      <div ref={hero} className="relative md:h-[185vh]">
        <section className="relative overflow-hidden md:sticky md:top-16 md:h-[calc(100vh-4rem)] flex items-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,rgba(34,211,238,0.14),transparent_55%)]" />

          <div className="mx-auto grid h-full max-w-7xl items-center gap-8 px-5 py-16 md:grid-cols-[1.1fr_1fr] md:py-0">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-3.5 py-1 text-xs font-semibold text-cyan shadow-[0_0_18px_rgba(34,211,238,0.25)] mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Next-Gen Earth Observation SaaS</span>
              </div>

              <h1 className="text-[clamp(2.7rem,5.6vw,5rem)] font-extrabold tracking-tight text-snow leading-[1.04]">
                Intelligence above. <br />
                <span className="bg-gradient-to-r from-emerald via-cyan to-violet bg-clip-text text-transparent">
                  Decisions below.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base sm:text-lg text-muted leading-relaxed">
                Empowering Sri Lankan agriculture, banking and insurance with live NASA satellite telemetry, crop suitability engines, and hyper-local climate risk modeling.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/register" className="btn btn-primary shadow-xl !px-6 !py-3.5">
                  <span>Start 14-Day Free Trial</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/platform" className="btn btn-ghost !px-6 !py-3.5">
                  <span>Explore Architecture</span>
                </Link>
              </div>

              <div className="mt-8 flex items-center gap-6 text-xs text-muted/80">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald" />
                  No card required
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-cyan" />
                  25 Districts mapped
                </span>
              </div>
            </motion.div>

            <div className="relative h-[420px] md:h-full flex items-center justify-center">
              <Globe progress={progress} />
              <div className="absolute -bottom-2 right-0 hidden xl:block">
                <SourceStatus />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Feature Modules Grid */}
      <section className="relative mx-auto max-w-7xl px-5 py-28">
        <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr] items-start">
          <div className="sticky top-28">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan">Mission Capabilities</span>
            <h2 className="mt-2 text-4xl font-extrabold text-snow tracking-tight">From space grid to farm decision</h2>
            <p className="mt-4 max-w-md text-sm text-muted leading-relaxed">
              AgriIntel ingests continental-scale NASA and Copernicus observations, translating raw physical variables into immediate, actionable intelligence for agricultural operators and underwriters.
            </p>
            <div className="mt-8 xl:hidden">
              <SourceStatus />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {MODULES.map((m) => (
              <div key={m.name} className="panel card-3d group p-6 border-line/60">
                <div className="flex items-center justify-between mb-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-panel border border-line/60 shadow-inner group-hover:border-cyan/40 transition-colors">
                    <m.icon className={`h-5 w-5 ${m.accent}`} aria-hidden />
                  </span>
                  <span className="text-[10px] font-mono uppercase text-muted">Verified</span>
                </div>
                <h3 className="text-base font-bold text-snow">{m.name}</h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real-time Engine Interactive Showcase: Module 1 & Module 2 */}
      <section className="relative mx-auto max-w-7xl px-5 py-20">
        <div className="card-3d glass-transmission rounded-3xl border border-cyan/40 bg-gradient-to-br from-panel/95 via-midnight/90 to-base/95 p-6 md:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
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
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(34,211,238,0.4)]"
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
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(34,211,238,0.4)]"
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
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(34,211,238,0.4)]"
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
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(34,211,238,0.4)]"
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
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(34,211,238,0.4)]"
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

                {/* Score Cards */}
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

                {/* Monthly Drought Risk & Flood Risk Row */}
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

                {/* 4 Pillars of Water Availability Index */}
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

                {/* Crop Irrigation Requirement Specification Table */}
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

                {/* Suitable Crops */}
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

                {/* 4 Soil Health Indicators */}
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

                {/* Best Crop Recommendation Rankings & Avoid */}
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

                  {/* Crop Diversification Recommendation */}
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

                {/* Prompt Example: Groundnut Expected Yield */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan">
                      Prompt Example: Groundnut Expected Yield
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

                {/* Additional Multi-Crop Table */}
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

      {/* How It Works (Steps) with 3D Depth */}
      <section className="relative border-y border-line/60 bg-gradient-to-b from-navy/50 via-abyss to-navy/50 py-28">
        <div className="mx-auto max-w-7xl px-5">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald">Pipeline Architecture</span>
            <h2 className="mt-2 text-4xl font-extrabold text-snow tracking-tight">How AgriIntel computes intelligence</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.name} className="panel card-3d relative p-6 border-line/60">
                <span className="font-mono text-2xl font-black text-cyan/30">{s.step}</span>
                <h3 className="mt-2 text-lg font-bold text-snow">{s.name}</h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Decision Simulator Interactive Teaser */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-28 md:grid-cols-2">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan">Interactive Modeling</span>
          <h2 className="mt-2 text-4xl font-extrabold text-snow tracking-tight">The Decision Simulator</h2>
          <p className="mt-4 text-sm text-muted leading-relaxed">
            Test realistic farming scenarios before investing capital. For example: Compare Green Gram, Sesame and Groundnut in Monaragala under a 20% Yala rainfall deficit. AgriIntel synthesizes the NASA POWER climate baseline, adjusts soil water budgets, and calculates estimated yields, revenues, and risk metrics.
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
                <XAxis type="number" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="crop" stroke="#94A3B8" fontSize={11} width={90} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(34, 211, 238, 0.08)" }}
                  contentStyle={{
                    background: "rgba(8, 22, 38, 0.95)",
                    border: "1px solid rgba(34, 211, 238, 0.3)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                  }}
                />
                <Bar dataKey="profit" fill="#10B981" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[11px] text-muted text-center">
            Illustrative output. Tailor parameters to actual farmer input costs and local pricing.
          </p>
        </div>
      </section>

      {/* Industry Verticals */}
      <section className="border-t border-line/60 py-24">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <h2 className="text-3xl font-extrabold text-snow tracking-tight">Built for agricultural risk bearers</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 md:grid-cols-5">
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

      {/* CTA Section */}
      <section className="relative overflow-hidden border-t border-line/60 bg-gradient-to-b from-navy/60 to-abyss py-28 text-center">
        <div className="pointer-events-none absolute -left-20 top-0 h-96 w-96 rounded-full bg-cyan/10 blur-[140px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-emerald/10 blur-[140px]" />

        <div className="relative mx-auto max-w-3xl px-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald/40 bg-emerald/10 px-3 py-1 text-xs font-semibold text-emerald mb-4">
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
            <Link href="/contact?kind=demo" className="btn btn-ghost !px-7 !py-3.5">
              <span>Schedule Live Walkthrough</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
