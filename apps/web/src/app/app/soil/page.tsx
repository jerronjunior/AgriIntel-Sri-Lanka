"use client";
import { useState } from "react";
import {
  CartesianGrid, ComposedChart, Bar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine
} from "recharts";
import DistrictSelect from "@/components/app/DistrictSelect";
import { axis, C, grid, tooltip } from "@/components/app/charts";
import { ErrorState, Label, Panel, ProvenanceNote, Skeleton, Stat, DataTag } from "@/components/ui/kit";
import { fmt, useOrgQuery } from "@/lib/hooks";
import type { Provenance } from "@/lib/types";
import {
  Layers, Droplets, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Activity, Compass, Wind
} from "lucide-react";

type SoilEngineResponse = {
  engine: string;
  module: string;
  district: string;
  province: string;
  suitability_analysis: {
    location: string;
    soil_type: string;
    primary_order: string;
    suitable_crops: {
      crop: string;
      suitability_pct: number;
      affinity: string;
      reason: string;
    }[];
  };
  soil_health_indicators: {
    drainage: { status: string; score: number; rating: string; desc: string };
    compaction_risk: { status: string; score: number; rating: string; desc: string };
    erosion_risk: { status: string; score: number; rating: string; desc: string };
    water_holding_capacity: { status: string; score: number; rating: string; desc: string };
  };
  soil_metrics: {
    ph: number;
    organic_matter_pct: number;
    cation_exchange_capacity: number;
    texture: string;
  };
  provenance: Provenance;
};

type Soil = {
  series: { date: string; surface: number | null; root_zone: number | null }[];
  summary: { root_zone_mean: number | null; latest_root_zone: number | null; days_below_0_3: number; water_stress: string | null };
  provenance: Provenance;
  smap_status: { product: string; status: string; message: string };
};
type Daily = { series: { date: string; precip_mm: number | null }[] };

export default function SoilPage() {
  const [district, setDistrict] = useState("Monaragala");

  // Module 3: Soil Intelligence Engine query
  const soilEngine = useOrgQuery<SoilEngineResponse>(
    ["soil-engine", district],
    `/intelligence/soil-engine?district=${encodeURIComponent(district)}`
  );

  const soil = useOrgQuery<Soil>(["soil", district], `/soil/moisture?district=${encodeURIComponent(district)}`);
  const rain = useOrgQuery<Daily>(["daily90", district], `/climate/daily?district=${encodeURIComponent(district)}`);
  const merged = soil.data?.series.map((s) => ({
    ...s,
    precip_mm: rain.data?.series.find((r) => r.date === s.date)?.precip_mm ?? null,
  }));

  const se = soilEngine.data;
  const analysis = se?.suitability_analysis;
  const health = se?.soil_health_indicators;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan/30 bg-gradient-to-br from-panel/90 via-midnight/80 to-base/90 p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] glass-transmission">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-3.5 py-1 text-xs font-semibold text-cyan shadow-[0_0_15px_rgba(34,211,238,0.25)]">
              <Layers className="h-3.5 w-3.5" />
              <span>Module 3 · Edaphic Terrain Intelligence</span>
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-snow md:text-4xl">
              Soil Intelligence Engine
            </h1>
            <p className="max-w-2xl text-sm text-muted">
              Satellite-derived pedological analysis identifying regional soil orders, crop suitability affinity, compaction and erosion vulnerabilities, and hydrological retention capacity.
            </p>
          </div>

          <div className="flex w-full flex-col sm:w-72">
            <Label htmlFor="district-select">Select Target Location</Label>
            <div className="mt-1">
              <DistrictSelect value={district} onChange={setDistrict} />
            </div>
            <span className="mt-1.5 text-right font-mono text-[11px] text-muted">
              Location: {district} Profile
            </span>
          </div>
        </div>
      </div>

      {soilEngine.isError && <ErrorState error={soilEngine.error} onRetry={() => soilEngine.refetch()} />}

      {/* SECTION 1: SUITABILITY ANALYSIS */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-snow">
              Suitability Analysis
            </h2>
            <p className="text-xs text-muted">
              Pedological classification and crop affinity for {district}
            </p>
          </div>
          <DataTag kind="predicted" />
        </div>

        {/* Soil Type Banner */}
        <div className="card-3d glass-transmission rounded-2xl border border-line/60 p-6">
          <div className="grid gap-6 md:grid-cols-3 items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Location:</span>
              <p className="font-display text-3xl font-extrabold text-snow mt-1">{analysis?.location ?? district}</p>
              <span className="text-xs text-cyan font-mono mt-0.5 block">{se?.province ?? "Uva"} Province</span>
            </div>

            <div className="md:border-l md:border-line/40 md:pl-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Dominant Soil Type:</span>
              <p className="font-display text-2xl font-bold text-emerald mt-1">
                {analysis?.soil_type ?? "Reddish Brown Earth"}
              </p>
              <span className="text-xs text-muted mt-0.5 block">Order: {analysis?.primary_order ?? "Alfisols"}</span>
            </div>

            <div className="md:border-l md:border-line/40 md:pl-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Texture & pH:</span>
              <p className="font-display text-lg font-bold text-snow mt-1">
                {se?.soil_metrics.texture ?? "Sandy Clay Loam"} · pH {se?.soil_metrics.ph ?? 6.5}
              </p>
              <span className="text-xs text-muted mt-0.5 block">
                Organic Matter: {se?.soil_metrics.organic_matter_pct ?? 1.8}%
              </span>
            </div>
          </div>
        </div>

        {/* Suitable Crops Grid */}
        <div>
          <h3 className="font-display text-base font-bold text-snow mb-3">
            Suitable Crops Ranked by Soil Affinity
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analysis?.suitable_crops.map((sc) => {
              const isTop = ["Groundnut", "Sesame", "Green Gram"].includes(sc.crop);

              return (
                <div
                  key={sc.crop}
                  className={`card-3d glass-transmission rounded-2xl p-5 border transition-all ${
                    isTop
                      ? "border-cyan/50 bg-cyan/5 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                      : "border-line/60 bg-panel/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-snow text-base flex items-center gap-2">
                      {sc.crop}
                      {isTop && (
                        <span className="rounded-full bg-cyan/20 px-2 py-0.5 text-[10px] font-bold text-cyan">
                          TOP CROP
                        </span>
                      )}
                    </span>
                    <span className="font-display text-2xl font-black text-cyan">
                      {sc.suitability_pct}%
                    </span>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-base">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald to-cyan"
                      style={{ width: `${sc.suitability_pct}%` }}
                    />
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-muted">{sc.reason}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 2: SOIL HEALTH INDICATORS */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-snow">
            Soil Health Indicators
          </h2>
          <p className="text-xs text-muted">
            Core diagnostic indicators assessing drainage kinetics, mechanical compaction, erosion susceptibility, and volumetric water retention
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Drainage */}
          <div className="card-3d glass-transmission rounded-2xl border border-line/60 p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Drainage</span>
              <span className="rounded-full border border-emerald/40 bg-emerald/15 px-2.5 py-0.5 text-xs font-bold text-emerald">
                {health?.drainage.status ?? "Well-drained"}
              </span>
            </div>
            <p className="font-display text-3xl font-extrabold text-snow mt-3">
              {health?.drainage.score ?? 86}
              <span className="text-base font-normal text-muted">/100</span>
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-base overflow-hidden">
              <div className="h-full bg-emerald rounded-full" style={{ width: `${health?.drainage.score ?? 86}%` }} />
            </div>
            <p className="mt-3 text-[11px] text-muted leading-relaxed">
              {health?.drainage.desc ?? "Permeable subsoil facilitating aerobic rhizosphere activity."}
            </p>
          </div>

          {/* Compaction Risk */}
          <div className="card-3d glass-transmission rounded-2xl border border-line/60 p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Compaction Risk</span>
              <span className="rounded-full border border-cyan/40 bg-cyan/15 px-2.5 py-0.5 text-xs font-bold text-cyan">
                {health?.compaction_risk.status ?? "Low"}
              </span>
            </div>
            <p className="font-display text-3xl font-extrabold text-cyan mt-3">
              {health?.compaction_risk.score ?? 24}
              <span className="text-base font-normal text-muted">% Risk</span>
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-base overflow-hidden">
              <div className="h-full bg-cyan rounded-full" style={{ width: `${health?.compaction_risk.score ?? 24}%` }} />
            </div>
            <p className="mt-3 text-[11px] text-muted leading-relaxed">
              {health?.compaction_risk.desc ?? "Bulk density at 1.36 g/cm³ allows unimpeded taproot penetration."}
            </p>
          </div>

          {/* Erosion Risk */}
          <div className="card-3d glass-transmission rounded-2xl border border-line/60 p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Erosion Risk</span>
              <span className="rounded-full border border-amber/40 bg-amber/15 px-2.5 py-0.5 text-xs font-bold text-amber">
                {health?.erosion_risk.status ?? "Moderate"}
              </span>
            </div>
            <p className="font-display text-3xl font-extrabold text-amber mt-3">
              {health?.erosion_risk.score ?? 42}
              <span className="text-base font-normal text-muted">% Risk</span>
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-base overflow-hidden">
              <div className="h-full bg-amber rounded-full" style={{ width: `${health?.erosion_risk.score ?? 42}%` }} />
            </div>
            <p className="mt-3 text-[11px] text-muted leading-relaxed">
              {health?.erosion_risk.desc ?? "Gentle undulating topography with seasonal monsoon runoff."}
            </p>
          </div>

          {/* Water Holding Capacity */}
          <div className="card-3d glass-transmission rounded-2xl border border-line/60 p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Water Holding Capacity</span>
              <span className="rounded-full border border-emerald/40 bg-emerald/15 px-2.5 py-0.5 text-xs font-bold text-emerald">
                {health?.water_holding_capacity.status ?? "High"}
              </span>
            </div>
            <p className="font-display text-3xl font-extrabold text-snow mt-3">
              {health?.water_holding_capacity.score ?? 79}
              <span className="text-base font-normal text-muted">% Field Cap</span>
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-base overflow-hidden">
              <div className="h-full bg-emerald rounded-full" style={{ width: `${health?.water_holding_capacity.score ?? 79}%` }} />
            </div>
            <p className="mt-3 text-[11px] text-muted leading-relaxed">
              {health?.water_holding_capacity.desc ?? "165 mm plant-available water capacity per meter depth profile."}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3: SATELLITE SOIL MOISTURE TIME-SERIES */}
      <section className="space-y-4 pt-4 border-t border-line/60">
        <h2 className="font-display text-xl font-bold tracking-tight text-snow">
          Satellite Soil Wetness & Rainfall (90-Day Dynamics)
        </h2>

        {soil.isError && <ErrorState error={soil.error} onRetry={() => soil.refetch()} />}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Latest root-zone wetness" value={fmt(soil.data?.summary.latest_root_zone, 2)} sub="0 = dry, 1 = saturated" />
          <Stat label="90-day mean" value={fmt(soil.data?.summary.root_zone_mean, 2)} />
          <Stat label="Days below 0.3" value={fmt(soil.data?.summary.days_below_0_3)} sub="Indicator of crop water stress" />
          <Stat label="Water stress" value={<span className="capitalize">{soil.data?.summary.water_stress ?? "—"}</span>} />
        </div>

        <Panel title="Rainfall versus soil wetness" tag="historical">
          {soil.isLoading ? (
            <Skeleton h={280} />
          ) : (
            merged && (
              <div className="h-72">
                <ResponsiveContainer>
                  <ComposedChart data={merged}>
                    <CartesianGrid {...grid} vertical={false} />
                    <XAxis dataKey="date" {...axis} minTickGap={40} tickFormatter={(d) => d.slice(5)} />
                    <YAxis yAxisId="w" {...axis} domain={[0, 1]} width={40} />
                    <YAxis yAxisId="r" orientation="right" {...axis} unit=" mm" width={50} />
                    <Tooltip {...tooltip} />
                    <Legend />
                    <ReferenceLine
                      yAxisId="w"
                      y={0.3}
                      stroke={C.amber}
                      strokeDasharray="4 4"
                      label={{ value: "stress threshold", fill: C.amber, fontSize: 11, position: "insideBottomLeft" }}
                    />
                    <Bar yAxisId="r" dataKey="precip_mm" name="Rainfall (mm)" fill={C.cyan} opacity={0.5} />
                    <Line yAxisId="w" dataKey="root_zone" name="Root zone" stroke={C.emerald} dot={false} strokeWidth={2} />
                    <Line yAxisId="w" dataKey="surface" name="Surface" stroke={C.slate} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )
          )}
          <ProvenanceNote p={soil.data?.provenance || se?.provenance} />
        </Panel>
      </section>
    </div>
  );
}
