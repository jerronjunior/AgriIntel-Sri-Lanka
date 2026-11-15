"use client";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Cell
} from "recharts";
import DistrictSelect from "@/components/app/DistrictSelect";
import { axis, C, grid, tooltip } from "@/components/app/charts";
import { ErrorState, Label, Panel, ProvenanceNote, Skeleton, Stat, DataTag } from "@/components/ui/kit";
import { fmt, useOrgQuery } from "@/lib/hooks";
import type { Provenance } from "@/lib/types";
import {
  Droplets, Waves, Gauge, Sprout, Sparkles, Activity, ShieldCheck, CheckCircle2,
  ArrowRight, Calculator, AlertCircle, Info, RefreshCw
} from "lucide-react";

type WaterEngineResponse = {
  engine: string;
  module: string;
  district: string;
  province: string;
  coordinates: { lat: number; lon: number };
  water_availability_index: {
    composite_score: number;
    status: string;
    metrics: {
      name: string;
      score: number;
      unit: string;
      status: string;
      description: string;
    }[];
  };
  irrigation_requirement: {
    district: string;
    crops: {
      crop: string;
      local_name: string;
      category: string;
      water_required_mm: number;
      growing_duration_days: number;
      recommended_method: string;
      peak_et_mm_day: number;
      savings_vs_flood_pct: number;
      critical_stage: string;
    }[];
    recommended_guidelines: string;
  };
  provenance: Provenance;
};

export default function WaterIntelligencePage() {
  const [district, setDistrict] = useState("Anuradhapura");
  const [acres, setAcres] = useState<number>(5);
  const [selectedCrop, setSelectedCrop] = useState<string>("Chili");

  const q = useOrgQuery<WaterEngineResponse>(
    ["water-engine", district],
    `/intelligence/water-engine?district=${encodeURIComponent(district)}`
  );

  const data = q.data;
  const indexData = data?.water_availability_index;
  const crops = data?.irrigation_requirement.crops || [];

  const currentCropObj = crops.find((c) => c.crop === selectedCrop) || crops[0];
  // 1 mm of rain over 1 acre = ~4.04686 cubic meters (m³)
  const volumeNeededM3 = currentCropObj ? Math.round(currentCropObj.water_required_mm * 4.04686 * acres) : 0;
  const volumeSavedM3 = currentCropObj ? Math.round(volumeNeededM3 * (currentCropObj.savings_vs_flood_pct / 100)) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan/30 bg-gradient-to-br from-panel/90 via-midnight/80 to-base/90 p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] glass-transmission">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-3.5 py-1 text-xs font-semibold text-cyan shadow-[0_0_15px_rgba(34,211,238,0.25)]">
              <Droplets className="h-3.5 w-3.5" />
              <span>Module 2 · Hydrological Precision Engine</span>
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-snow md:text-4xl">
              Water Intelligence Engine
            </h1>
            <p className="max-w-2xl text-sm text-muted">
              Deep hydrological synthesis evaluating regional water availability across reservoir cascades, aquifers, and soil retention, paired with crop-specific irrigation demand analytics.
            </p>
          </div>

          <div className="flex w-full flex-col sm:w-72">
            <Label htmlFor="district-select">Select Target District</Label>
            <div className="mt-1">
              <DistrictSelect value={district} onChange={setDistrict} />
            </div>
            <span className="mt-1.5 text-right font-mono text-[11px] text-muted">
              Hydro Basin: {district} Cascades
            </span>
          </div>
        </div>
      </div>

      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}

      {/* SECTION 1: WATER AVAILABILITY INDEX */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-snow">
              Water Availability Index
            </h2>
            <p className="text-xs text-muted">
              Multi-source composite index derived from tank reservoirs, groundwater recharge, and soil moisture retention
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Regional Hydro Health:</span>
            <span className="rounded-full border border-cyan/40 bg-cyan/15 px-3 py-0.5 text-xs font-bold text-cyan shadow-[0_0_12px_rgba(34,211,238,0.25)]">
              {indexData?.status ?? "Optimal"} ({indexData?.composite_score ?? 64.2} / 100)
            </span>
          </div>
        </div>

        {/* 4 Core Indicators Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {indexData?.metrics.map((metric) => {
            const isHigh = metric.status === "High";
            const isMod = metric.status === "Moderate";

            return (
              <div
                key={metric.name}
                className="card-3d glass-transmission rounded-2xl border border-line/60 p-5 relative overflow-hidden transition-all hover:border-cyan/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {metric.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                      isHigh
                        ? "border-emerald/40 bg-emerald/15 text-emerald"
                        : isMod
                        ? "border-cyan/40 bg-cyan/15 text-cyan"
                        : "border-amber/40 bg-amber/15 text-amber"
                    }`}
                  >
                    {metric.status}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold text-snow">
                    {metric.score}
                    <span className="text-xl font-semibold text-muted">%</span>
                  </span>
                  <span className="text-xs text-cyan font-medium">Index Capacity</span>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-base">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      isHigh
                        ? "bg-gradient-to-r from-emerald to-cyan shadow-[0_0_10px_rgba(52,211,153,0.4)]"
                        : isMod
                        ? "bg-cyan shadow-[0_0_10px_rgba(34,211,238,0.4)]"
                        : "bg-amber"
                    }`}
                    style={{ width: `${metric.score}%` }}
                  />
                </div>

                <p className="mt-3 text-[11px] leading-relaxed text-muted">{metric.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: IRRIGATION REQUIREMENT SPECIFICATION */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-snow">
              Irrigation Requirement
            </h2>
            <p className="text-xs text-muted">
              Seasonal crop water requirements (mm), peak evapotranspiration (ET₀), and precision delivery methods
            </p>
          </div>
          <DataTag kind="predicted" />
        </div>

        {/* Crops Table */}
        <div className="card-3d glass-transmission overflow-hidden rounded-2xl border border-line/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line/60 bg-panel/60 font-mono text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-4">Crop</th>
                  <th className="px-5 py-4">Local Name</th>
                  <th className="px-5 py-4 text-right">Water Required</th>
                  <th className="px-5 py-4">Duration</th>
                  <th className="px-5 py-4">Recommended Method</th>
                  <th className="px-5 py-4 text-right">Peak ET₀</th>
                  <th className="px-5 py-4 text-right">Water Savings</th>
                  <th className="px-5 py-4">Critical Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40 font-sans">
                {crops.map((c) => {
                  const isHighlighted = ["Green Gram", "Cowpea", "Chili"].includes(c.crop);
                  const isSelected = selectedCrop === c.crop;

                  return (
                    <tr
                      key={c.crop}
                      onClick={() => setSelectedCrop(c.crop)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-cyan/15 text-snow"
                          : isHighlighted
                          ? "bg-emerald/5 hover:bg-emerald/10"
                          : "hover:bg-panel/50"
                      }`}
                    >
                      <td className="px-5 py-4 font-semibold text-snow flex items-center gap-2">
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-cyan" />}
                        <span>{c.crop}</span>
                        {isHighlighted && (
                          <span className="rounded-full bg-cyan/20 px-1.5 py-0.2 text-[9px] font-bold text-cyan">
                            CORE
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted">{c.local_name}</td>
                      <td className="px-5 py-4 text-right font-display text-base font-extrabold text-cyan">
                        {c.water_required_mm} <span className="text-xs font-normal text-muted">mm</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted">{c.growing_duration_days} days</td>
                      <td className="px-5 py-4 text-xs font-medium text-snow">
                        <span className="rounded-lg bg-panel/80 px-2.5 py-1 border border-line/60">
                          {c.recommended_method}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-xs text-snow">
                        {c.peak_et_mm_day} mm/d
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-mono text-xs font-bold text-emerald">
                          +{c.savings_vs_flood_pct}%
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted">{c.critical_stage}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comparative Chart and Precision Calculator */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Water Requirement Comparative Chart */}
          <div className="card-3d glass-transmission rounded-2xl border border-line/60 p-5 lg:col-span-7">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-bold text-snow">
                Crop Water Demand Benchmark (mm)
              </h3>
              <span className="font-mono text-[11px] text-muted">Lower = Greater Water Efficiency</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={crops} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid {...grid} vertical={false} />
                  <XAxis dataKey="crop" {...axis} angle={-25} textAnchor="end" height={45} />
                  <YAxis {...axis} unit=" mm" width={60} />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="water_required_mm" name="Water Required (mm)" radius={[6, 6, 0, 0]}>
                    {crops.map((entry) => (
                      <Cell
                        key={`cell-${entry.crop}`}
                        fill={
                          entry.crop === selectedCrop
                            ? C.cyan
                            : entry.crop === "Green Gram"
                            ? C.emerald
                            : entry.crop === "Cowpea"
                            ? "#10b981"
                            : entry.crop === "Chili"
                            ? C.amber
                            : C.slate
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Precision Volume Calculator */}
          <div className="card-3d glass-transmission rounded-2xl border border-cyan/40 bg-gradient-to-br from-panel/90 to-midnight/90 p-5 lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-cyan mb-2">
                <Calculator className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Precision Volume Calculator</span>
              </div>
              <h3 className="font-display text-xl font-bold text-snow">
                {currentCropObj?.crop} Farm Demand
              </h3>
              <p className="mt-1 text-xs text-muted">
                Calculates total volumetric irrigation requirements and conservation potential for {district}.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <Label htmlFor="acres-range">Farm Size: {acres} Acres</Label>
                    <span className="font-mono text-cyan">({(acres * 0.404686).toFixed(1)} ha)</span>
                  </div>
                  <input
                    id="acres-range"
                    type="range"
                    min="1"
                    max="50"
                    value={acres}
                    onChange={(e) => setAcres(Number(e.target.value))}
                    className="w-full accent-cyan"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-xl border border-line/60 bg-base/60 p-3">
                    <span className="text-[11px] text-muted block">Gross Water Required</span>
                    <span className="font-display text-2xl font-extrabold text-snow">
                      {volumeNeededM3.toLocaleString()} <span className="text-xs font-normal text-muted">m³</span>
                    </span>
                    <span className="text-[10px] text-muted block mt-0.5">
                      {(volumeNeededM3 / 1000).toFixed(2)} Megaliters
                    </span>
                  </div>

                  <div className="rounded-xl border border-emerald/40 bg-emerald/10 p-3">
                    <span className="text-[11px] text-emerald block font-semibold">Precision Water Saved</span>
                    <span className="font-display text-2xl font-extrabold text-emerald">
                      {volumeSavedM3.toLocaleString()} <span className="text-xs font-normal text-muted">m³</span>
                    </span>
                    <span className="text-[10px] text-emerald block mt-0.5 font-mono">
                      -{currentCropObj?.savings_vs_flood_pct}% vs Flood
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-line/40 bg-panel/40 p-3 text-xs text-muted">
              <p className="flex items-center gap-1.5 font-semibold text-snow mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan" />
                Agronomic Guideline
              </p>
              {data?.irrigation_requirement.recommended_guidelines}
            </div>
          </div>
        </div>
      </section>

      {/* Provenance Footer */}
      <ProvenanceNote p={data?.provenance} />
    </div>
  );
}
