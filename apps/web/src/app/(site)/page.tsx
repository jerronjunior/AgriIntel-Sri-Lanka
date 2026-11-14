"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CloudRain, Droplets, Landmark, LineChart, Shield, Sprout, Tractor, TrendingUp, Building2, Wheat,
  Sparkles, ArrowRight, Radio, Satellite, Layers, ShieldCheck
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

export default function Home() {
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
