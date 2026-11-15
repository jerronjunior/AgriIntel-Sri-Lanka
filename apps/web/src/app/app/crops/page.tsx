"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Cell
} from "recharts";
import DistrictSelect from "@/components/app/DistrictSelect";
import { axis, C, grid, tooltip } from "@/components/app/charts";
import { DataTag, ErrorState, Label, Panel, ProvenanceNote, Skeleton, Stat } from "@/components/ui/kit";
import { api } from "@/lib/api";
import { fmt, useOrgQuery } from "@/lib/hooks";
import type { Provenance } from "@/lib/types";
import {
  Sprout, Award, AlertOctagon, PieChart, TrendingUp, Sparkles, CheckCircle2,
  SlidersHorizontal, ArrowRight, ShieldCheck, Layers, Gauge
} from "lucide-react";

type CropSuitabilityResponse = {
  engine: string;
  module: string;
  district: string;
  season: string;
  total_land_hectares: number;
  best_crop_recommendation: {
    location: string;
    season: string;
    ranking: {
      rank: number;
      crop: string;
      local_name: string;
      suitability_score: number;
      status: string;
      est_net_profit_lkr_ha: number;
      rationale: string;
    }[];
    avoid: {
      crop: string;
      local_name: string;
      reason: string;
      severity: string;
    }[];
  };
  crop_diversification_recommendation: {
    land_hectares: number;
    allocation: {
      crop: string;
      share_pct: number;
      allocated_hectares: number;
      role: string;
      target_yield_mt_ha: number;
    }[];
    diversification_index: number;
    risk_mitigation_benefit: string;
  };
  provenance: Provenance;
};

type YieldForecastResponse = {
  engine: string;
  module: string;
  district: string;
  crop: string;
  season: string;
  expected_yield: {
    crop: string;
    unit: string;
    best_case: number;
    expected: number;
    average_case: number;
    worst_case: number;
    scenarios: {
      best: { yield: number; unit: string; conditions: string };
      expected: { yield: number; unit: string; conditions: string };
      worst: { yield: number; unit: string; conditions: string };
    };
  };
  multi_crop_benchmarks: {
    crop: string;
    unit: string;
    best: number;
    expected: number;
    worst: number;
  }[];
  provenance: Provenance;
};

function CropIntelligence() {
  const sp = useSearchParams();
  const [district, setDistrict] = useState(sp.get("district") ?? "Hambantota");
  const [season, setSeason] = useState<"maha" | "yala">("yala");
  const [landHa, setLandHa] = useState<number>(100);
  const [selectedCrop, setSelectedCrop] = useState<string>("groundnut");

  // Module 4: Crop Suitability Intelligence query
  const suitQuery = useOrgQuery<CropSuitabilityResponse>(
    ["crop-suitability", district, season, landHa],
    `/intelligence/crop-suitability-engine?district=${encodeURIComponent(district)}&season=${season}&land_hectares=${landHa}`
  );

  // Module 5: Yield Forecasting Engine query
  const yieldQuery = useOrgQuery<YieldForecastResponse>(
    ["yield-forecast", district, selectedCrop, season],
    `/intelligence/yield-forecasting-engine?district=${encodeURIComponent(district)}&crop=${encodeURIComponent(selectedCrop)}&season=${season}`
  );

  const cs = suitQuery.data;
  const bestRec = cs?.best_crop_recommendation;
  const divRec = cs?.crop_diversification_recommendation;

  const yf = yieldQuery.data;
  const curYield = yf?.expected_yield;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan/30 bg-gradient-to-br from-panel/90 via-midnight/80 to-base/90 p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] glass-transmission">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-3.5 py-1 text-xs font-semibold text-cyan shadow-[0_0_15px_rgba(34,211,238,0.25)]">
              <Sprout className="h-3.5 w-3.5" />
              <span>Modules 4 & 5 · Agronomic Decision System</span>
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-snow md:text-4xl">
              Crop Suitability & Yield Forecasting
            </h1>
            <p className="max-w-2xl text-sm text-muted">
              Algorithmic crop ranking, species vulnerability screening, multi-crop diversification allocation, and multi-scenario probabilistic yield forecasting (Best, Expected, Worst).
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
            <div>
              <Label htmlFor="district-select">Location</Label>
              <DistrictSelect value={district} onChange={setDistrict} />
            </div>
            <div>
              <Label htmlFor="season-select">Season</Label>
              <select
                id="season-select"
                className="field mt-1"
                value={season}
                onChange={(e) => setSeason(e.target.value as "maha" | "yala")}
              >
                <option value="yala">Yala Season</option>
                <option value="maha">Maha Season</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {suitQuery.isError && <ErrorState error={suitQuery.error} onRetry={() => suitQuery.refetch()} />}

      {/* =========================================================================
          MODULE 4: CROP SUITABILITY INTELLIGENCE
          ========================================================================= */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-cyan/20 px-2 py-0.5 text-xs font-bold text-cyan">Module 4</span>
              <h2 className="font-display text-2xl font-bold tracking-tight text-snow">
                Crop Suitability Intelligence
              </h2>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Best crop recommendations & portfolio diversification for {district} ({season.toUpperCase()})
            </p>
          </div>
          <DataTag kind="predicted" />
        </div>

        {/* 1. Best Crop Recommendation Grid */}
        <div>
          <h3 className="font-display text-base font-bold text-snow mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-cyan" />
            <span>Best Crop Recommendation</span>
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bestRec?.ranking.map((item) => (
              <div
                key={item.crop}
                onClick={() => setSelectedCrop(item.crop.toLowerCase())}
                className={`card-3d glass-transmission rounded-2xl p-5 border cursor-pointer transition-all ${
                  item.rank === 1
                    ? "border-emerald/50 bg-emerald/5 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                    : "border-line/60 bg-panel/40 hover:border-cyan/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-cyan/20 px-2.5 py-0.5 font-mono text-xs font-bold text-cyan">
                    Rank {item.rank}
                  </span>
                  <span className="font-display text-xl font-extrabold text-snow">
                    {item.suitability_score}%
                  </span>
                </div>

                <div className="mt-3">
                  <h4 className="font-display text-xl font-bold text-snow">{item.crop}</h4>
                  <span className="font-mono text-xs text-muted">{item.local_name}</span>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-base">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan to-emerald"
                    style={{ width: `${item.suitability_score}%` }}
                  />
                </div>

                <div className="mt-4 pt-3 border-t border-line/40 text-xs">
                  <span className="text-muted block">Est. Net Margin:</span>
                  <span className="font-mono font-bold text-emerald">
                    LKR {item.est_net_profit_lkr_ha.toLocaleString()} / Ha
                  </span>
                </div>

                <p className="mt-2 text-[11px] text-muted leading-relaxed line-clamp-2">{item.rationale}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Avoid Crops Alert Card */}
        {bestRec?.avoid.map((av) => (
          <div
            key={av.crop}
            className="rounded-2xl border border-rose/40 bg-gradient-to-r from-rose/10 via-panel/80 to-base/80 p-5 shadow-[0_0_25px_rgba(251,113,133,0.15)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose/20 text-rose border border-rose/30 mt-0.5">
                  <AlertOctagon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose">Avoid Crop Flag</span>
                    <span className="rounded-full bg-rose/20 px-2 py-0.2 text-[10px] font-bold text-rose">
                      {av.severity}
                    </span>
                  </div>
                  <h4 className="font-display text-lg font-bold text-snow mt-1">
                    Avoid: {av.crop} ({av.local_name})
                  </h4>
                  <p className="mt-1 text-xs text-muted max-w-3xl leading-relaxed">{av.reason}</p>
                </div>
              </div>

              <div className="rounded-xl border border-line/60 bg-base/60 p-3 text-right">
                <span className="text-[10px] uppercase font-mono text-muted block">Vulnerability</span>
                <span className="text-xs font-bold text-rose">Bulb Rot & Heat Shock</span>
              </div>
            </div>
          </div>
        ))}

        {/* 3. Crop Diversification Recommendation */}
        <div className="card-3d glass-transmission rounded-2xl border border-line/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-line/40 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-lg font-bold text-snow">
                  Crop Diversification Recommendation
                </h3>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Optimal risk-adjusted land allocation across complementary species
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="land-input">Total Land Allocation:</Label>
              <div className="flex items-center gap-1.5">
                <input
                  id="land-input"
                  type="number"
                  min="1"
                  max="1000"
                  value={landHa}
                  onChange={(e) => setLandHa(Number(e.target.value))}
                  className="field !w-24 font-mono font-bold text-snow"
                />
                <span className="font-mono text-xs text-cyan">Hectares</span>
              </div>
            </div>
          </div>

          {/* Allocation Progress Bar */}
          <div className="mb-6">
            <div className="flex h-4 w-full overflow-hidden rounded-xl bg-base p-0.5 border border-line/60">
              <div
                title="Groundnut 40%"
                className="h-full rounded-l-lg bg-emerald transition-all"
                style={{ width: "40%" }}
              />
              <div
                title="Sesame 25%"
                className="h-full bg-cyan transition-all"
                style={{ width: "25%" }}
              />
              <div
                title="Cowpea 20%"
                className="h-full bg-amber transition-all"
                style={{ width: "20%" }}
              />
              <div
                title="Chili 15%"
                className="h-full rounded-r-lg bg-rose transition-all"
                style={{ width: "15%" }}
              />
            </div>
          </div>

          {/* Allocation Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {divRec?.allocation.map((item) => {
              const colorCls =
                item.crop === "Groundnut"
                  ? "text-emerald border-emerald/40 bg-emerald/10"
                  : item.crop === "Sesame"
                  ? "text-cyan border-cyan/40 bg-cyan/10"
                  : item.crop === "Cowpea"
                  ? "text-amber border-amber/40 bg-amber/10"
                  : "text-rose border-rose/40 bg-rose/10";

              return (
                <div key={item.crop} className="rounded-xl border border-line/60 bg-panel/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-snow">{item.crop}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold border ${colorCls}`}>
                      {item.share_pct}%
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="font-display text-2xl font-extrabold text-snow">
                      {item.allocated_hectares} <span className="text-xs font-normal text-muted">Ha</span>
                    </span>
                    <span className="text-[11px] text-muted block mt-0.5 font-mono">
                      Target Yield: {item.target_yield_mt_ha} MT/Ha
                    </span>
                  </div>
                  <span className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-muted border-t border-line/30 pt-2">
                    {item.role}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-cyan/30 bg-cyan/5 p-4 flex items-center justify-between">
            <p className="text-xs text-muted flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan shrink-0" />
              <span>{divRec?.risk_mitigation_benefit}</span>
            </p>
            <span className="font-mono text-xs font-bold text-cyan shrink-0 ml-4">
              Diversification Index: {divRec?.diversification_index ?? 92}/100
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          MODULE 5: YIELD FORECASTING ENGINE
          ========================================================================= */}
      <section className="space-y-6 pt-6 border-t border-line/60">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald/20 px-2 py-0.5 text-xs font-bold text-emerald">Module 5</span>
              <h2 className="font-display text-2xl font-bold tracking-tight text-snow">
                Yield Forecasting Engine
              </h2>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Probabilistic multi-scenario yield prediction: Best Case · Average Case · Worst Case
            </p>
          </div>
          <DataTag kind="predicted" />
        </div>

        {/* Crop Yield Scenario Cards */}
        <div className="card-3d glass-transmission rounded-2xl border border-line/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Forecasted Crop</span>
              <h3 className="font-display text-2xl font-bold text-snow mt-1">
                {curYield?.crop ?? "Groundnut"}
              </h3>
              <span className="text-xs text-muted font-mono">Unit: {curYield?.unit ?? "MT/Ha"} (Metric Tons per Hectare)</span>
            </div>

            {/* Quick Switcher */}
            <div className="flex flex-wrap gap-2">
              {["groundnut", "sesame", "green gram", "cowpea", "chili", "maize", "paddy"].map((cr) => (
                <button
                  key={cr}
                  onClick={() => setSelectedCrop(cr)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all border ${
                    selectedCrop === cr
                      ? "border-cyan bg-cyan text-night shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                      : "border-line/60 bg-panel/60 text-muted hover:border-cyan/40 hover:text-snow"
                  }`}
                >
                  {cr}
                </button>
              ))}
            </div>
          </div>

          {/* 3 Scenario Pillars (Best, Expected, Worst) */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* Best Case */}
            <div className="card-3d rounded-2xl border border-emerald/50 bg-gradient-to-b from-emerald/10 to-panel/60 p-5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald">Best Case</span>
                <span className="rounded-full bg-emerald/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald">
                  Optimal +10% Rain
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-4xl font-extrabold text-emerald">
                  {curYield?.best_case ?? 2.8}
                </span>
                <span className="font-mono text-sm font-semibold text-muted">MT/Ha</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {curYield?.scenarios.best.conditions ?? "Optimal rainfall distribution, zero prolonged dry spells, precision micro-fertigation."}
              </p>
            </div>

            {/* Expected / Average Case */}
            <div className="card-3d rounded-2xl border border-cyan/50 bg-gradient-to-b from-cyan/10 to-panel/60 p-5 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan">Expected / Average Case</span>
                <span className="rounded-full bg-cyan/20 px-2.5 py-0.5 text-[10px] font-bold text-cyan">
                  Baseline Climatology
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-4xl font-extrabold text-cyan">
                  {curYield?.expected ?? 2.4}
                </span>
                <span className="font-mono text-sm font-semibold text-muted">MT/Ha</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {curYield?.scenarios.expected.conditions ?? "Standard seasonal agronomic conditions, baseline drip irrigation, typical weed pressure."}
              </p>
            </div>

            {/* Worst Case */}
            <div className="card-3d rounded-2xl border border-rose/50 bg-gradient-to-b from-rose/10 to-panel/60 p-5 shadow-[0_0_20px_rgba(251,113,133,0.15)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose">Worst Case</span>
                <span className="rounded-full bg-rose/20 px-2.5 py-0.5 text-[10px] font-bold text-rose">
                  Drought Stress
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-4xl font-extrabold text-rose">
                  {curYield?.worst_case ?? 1.9}
                </span>
                <span className="font-mono text-sm font-semibold text-muted">MT/Ha</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {curYield?.scenarios.worst.conditions ?? "Extreme heat stress during pegging stage (>35°C), moisture deficit > 40 mm."}
              </p>
            </div>
          </div>
        </div>

        {/* Multi-Crop Comparative Yield Benchmarks Chart */}
        <div className="card-3d glass-transmission rounded-2xl border border-line/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-bold text-snow">
                Multi-Crop Scenario Yield Benchmarks (MT/Ha)
              </h3>
              <p className="text-xs text-muted">Comparative yield envelope across Sri Lankan commodities</p>
            </div>
            <span className="font-mono text-xs text-cyan">Metric Tons / Hectare</span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yf?.multi_crop_benchmarks || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid {...grid} vertical={false} />
                <XAxis dataKey="crop" {...axis} angle={-20} textAnchor="end" height={45} />
                <YAxis {...axis} unit=" MT" width={55} />
                <Tooltip {...tooltip} />
                <Legend />
                <Bar dataKey="best" name="Best Case" fill={C.emerald} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expected" name="Expected / Average" fill={C.cyan} radius={[4, 4, 0, 0]} />
                <Bar dataKey="worst" name="Worst Case" fill={C.amber} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <ProvenanceNote p={cs?.provenance || yf?.provenance} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <CropIntelligence />
    </Suspense>
  );
}
