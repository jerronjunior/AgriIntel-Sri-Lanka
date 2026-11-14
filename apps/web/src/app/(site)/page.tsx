"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudRain, Droplets, Landmark, LineChart, Shield, Sprout, Tractor, TrendingUp, Building2, Wheat } from "lucide-react";
import Globe from "@/components/globe/Globe";
import { DataTag } from "@/components/ui/kit";
import { api } from "@/lib/api";
import type { Plan } from "@/lib/types";

const FEED_LABEL: Record<string, string> = {
  nasa_power_daily: "NASA POWER daily weather", nasa_power_climatology: "NASA POWER climate normals", nasa_power_soil_wetness: "MERRA-2 soil wetness",
  gpm_imerg_final: "GPM IMERG rainfall", smap_l3_enhanced: "SMAP soil moisture", smap_l4_rootzone: "SMAP root-zone moisture", sentinel2_l2a: "Sentinel-2 vegetation",
};
type Source = { key: string; provider: string; product: string; spatial_resolution: string; status: string; last_success_at: string | null };

function SourceStatus() {
  const q = useQuery({ queryKey: ["sources"], queryFn: () => api<{ items: Source[] }>("/data-sources", { auth: false, org: false }) });
  const dot = (s: string) => (s === "operational" ? "bg-emerald" : s === "degraded" ? "bg-amber" : "bg-slate/50");
  return (
    <div className="glass w-full max-w-[18rem] rounded-2xl p-4 text-sm shadow-2xl shadow-cyan/5">
      <p className="mb-3 font-semibold">Earth observation feeds</p>
      {q.isLoading && <div className="skeleton h-28" />}
      {q.isError && <p className="text-muted">The API isn&apos;t reachable right now, so live feed status can&apos;t be shown.</p>}
      <ul className="space-y-2">
        {q.data?.items.filter((s) => s.key !== "smap_l4_rootzone").map((s) => (
          <li key={s.key} className="flex items-start gap-2">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot(s.status)}`} aria-hidden />
            <span className="flex-1 leading-snug"><span className="text-ink">{FEED_LABEL[s.key] ?? s.product}</span>
              <span className="block text-xs text-muted">{s.spatial_resolution}, {s.status.replace("_", " ")}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MODULES = [
  { icon: CloudRain, name: "Climate intelligence", body: "Daily temperature, rainfall, humidity, wind and solar radiation for any point in Sri Lanka, compared against 2001–2020 normals." },
  { icon: Droplets, name: "Soil and water", body: "Root-zone wetness trends and water stress flags, with the spatial resolution stated next to every number." },
  { icon: Sprout, name: "Crop suitability", body: "A transparent rules model ranks paddy, maize, pulses, oilseeds, chili and onion for Maha or Yala, and explains why." },
  { icon: TrendingUp, name: "Profitability", body: "Revenue, cost, ROI and break-even price per crop from your own yield, price and cost assumptions." },
  { icon: LineChart, name: "Market intelligence", body: "Import official price series, compare districts and seasons, and see volatility before you plant." },
  { icon: Shield, name: "Agricultural risk", body: "Climate, production and market components combined into one configurable index you can audit line by line." },
];

const STEPS = [
  { name: "Ingest", body: "NASA POWER daily and climatology data are fetched on schedule, retried on failure and stored with provider, product and resolution." },
  { name: "Normalise", body: "Fill values become gaps, not zeros. Every series keeps its observation date and retrieval time." },
  { name: "Model", body: "Suitability, water balance and risk run on the cleaned inputs with documented, editable parameters." },
  { name: "Decide", body: "Compare crops side by side under your scenario and export a PDF with every assumption written down." },
];

const DEMO = [
  { crop: "Green gram", profit: 410 }, { crop: "Sesame", profit: 290 }, { crop: "Groundnut", profit: 150 },
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
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api<{ items: Plan[] }>("/subscriptions/plans", { auth: false, org: false }) });

  return (
    <>
      {/* Hero: the globe stays pinned while the camera turns to Sri Lanka as you scroll */}
      <div ref={hero} className="relative md:h-[180vh]">
        <section className="relative overflow-hidden md:sticky md:top-16 md:h-[calc(100vh-4rem)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,rgb(34_211_238/0.10),transparent_55%)]" />
          <div className="mx-auto grid h-full max-w-7xl items-center gap-6 px-5 py-12 md:grid-cols-[1.1fr_1fr] md:py-0">
            <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }} className="relative z-10">
              <h1 className="text-[clamp(2.6rem,5.4vw,4.75rem)] font-semibold">Intelligence above.<br />Better decisions below.</h1>
              <p className="mt-6 max-w-xl text-lg text-muted">Transform NASA Earth Observation data into powerful agricultural insights, climate risk intelligence, crop recommendations, and profitability forecasts.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/platform" className="btn btn-primary">Explore the intelligence platform</Link>
                <Link href="/contact?kind=demo" className="btn btn-ghost">Request an enterprise demo</Link>
              </div>
            </motion.div>
            <div className="relative h-[380px] md:h-full">
              <Globe progress={progress} />
              <div className="absolute -bottom-2 right-0 hidden xl:block"><SourceStatus /></div>
            </div>
          </div>
        </section>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-24">
        <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-4xl font-semibold">From grid cell to field decision</h2>
            <p className="mt-4 max-w-md text-muted">AgriIntel turns coarse, global satellite and reanalysis products into answers a farm manager, underwriter or loan officer can act on, without hiding how coarse the inputs are.</p>
            <div className="mt-6 xl:hidden"><SourceStatus /></div>
          </div>
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {MODULES.map((m) => (
              <li key={m.name}>
                <m.icon className="h-5 w-5 text-cyan" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{m.name}</h3>
                <p className="mt-1 text-sm text-muted">{m.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-line bg-navy">
        <div className="mx-auto max-w-7xl px-5 py-24">
          <h2 className="text-4xl font-semibold">How AgriIntel works</h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.name} className="relative border-t border-cyan/30 pt-5">
                <span className="font-display text-sm text-cyan">Step {i + 1}</span>
                <h3 className="mt-1 text-xl font-semibold">{s.name}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 md:grid-cols-2">
        <div>
          <h2 className="text-4xl font-semibold">The Decision Simulator</h2>
          <p className="mt-4 text-muted">A commercial farm in Monaragala wants to compare green gram, sesame and groundnut if Yala rainfall falls 20%. Pick the district, crops and assumptions; AgriIntel loads the NASA POWER climate baseline, applies your scenario and ranks each crop on suitability, water deficit, profit and risk.</p>
          <p className="mt-4 text-sm text-muted">Scenarios are always labelled as hypothetical and kept apart from observed data.</p>
          <Link href="/register" className="btn btn-primary mt-8">Run your first scenario</Link>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between"><p className="font-semibold">Net profit per hectare, LKR ’000</p><DataTag kind="demo" /></div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={DEMO} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" stroke="#94A3B8" fontSize={12} />
                <YAxis type="category" dataKey="crop" stroke="#94A3B8" fontSize={12} width={90} />
                <Tooltip cursor={{ fill: "rgb(34 211 238 / 0.06)" }} contentStyle={{ background: "#061421", border: "1px solid rgb(148 163 184 / .2)" }} />
                <Bar dataKey="profit" fill="#10B981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted">Illustrative layout only. Real results depend on your yields, prices and costs.</p>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl px-5 py-24">
          <h2 className="text-4xl font-semibold">Built for the people who carry agricultural risk</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-5">
            {[{ i: Tractor, n: "Commercial farms" }, { i: Landmark, n: "Agricultural banks" }, { i: Shield, n: "Insurers" }, { i: Wheat, n: "Agribusinesses" }, { i: Building2, n: "Government agencies" }].map(({ i: I, n }) => (
              <Link key={n} href="/industries" className="group">
                <I className="h-6 w-6 text-emerald" aria-hidden /><p className="mt-3 font-semibold group-hover:text-cyan">{n}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-navy">
        <div className="mx-auto max-w-7xl px-5 py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-semibold">Plans</h2>
            <Link href="/pricing" className="text-sm text-cyan hover:underline">Compare plan features</Link>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {plans.isLoading && [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}
            {plans.isError && <p className="text-muted md:col-span-4">Plans are unavailable while the API is offline.</p>}
            {plans.data?.items.map((p) => (
              <div key={p.key} className="border-l border-line pl-5">
                <p className="font-display text-xl font-semibold">{p.name}</p>
                <p className="mt-1 text-sm text-muted">{p.audience}</p>
                <p className="mt-4 text-sm">{p.price_amount != null ? `${p.price_currency} ${p.price_amount.toLocaleString()} / ${p.billing_period}` : "Pricing on request"}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 text-center">
        <h2 className="text-4xl font-semibold">See your districts through AgriIntel</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">Tell us about your portfolio and we&apos;ll walk you through the map, the simulator and the risk engine with your own districts.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/contact?kind=demo" className="btn btn-primary">Request an enterprise demo</Link>
          <Link href="/register" className="btn btn-ghost">Start a free trial</Link>
        </div>
      </section>
    </>
  );
}
