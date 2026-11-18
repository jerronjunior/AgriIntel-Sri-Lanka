"use client";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend
} from "recharts";
import DistrictSelect from "@/components/app/DistrictSelect";
import { axis, C, grid, tooltip } from "@/components/app/charts";
import { ErrorState, Label, Panel, ProvenanceNote, Skeleton, Stat, DataTag } from "@/components/ui/kit";
import { fmt, useOrgQuery } from "@/lib/hooks";
import type { Provenance } from "@/lib/types";
import {
  CloudRain, Droplets, Thermometer, Wind, AlertTriangle, ShieldCheck, Flame, Compass,
  TrendingDown, TrendingUp, Sparkles, Activity, Calendar, ShieldAlert
} from "lucide-react";

type Daily = {
  series: {
    date: string;
    t2m: number | null;
    t2m_max: number | null;
    t2m_min: number | null;
    precip_mm: number | null;
    rh2m: number | null;
    solar_kwh_m2: number | null;
    wind_ms: number | null;
  }[];
  summary: {
    total_precip_mm: number | null;
    mean_temp_c: number | null;
    max_temp_c: number | null;
    heavy_rain_days_50mm: number;
    dry_days_lt1mm: number;
    missing_days: number;
  };
  provenance: Provenance;
};

type Season = {
  mean_temp_c: number;
  rainfall_mm: number;
  elevation_m: number | null;
  provenance: Provenance;
};

type ClimateEngineResponse = {
  engine: string;
  module: string;
  district: string;
  province: string;
  district_climate_score: {
    district: string;
    climate_stability_pct: number;
    rainfall_deviation_pct: number;
    heat_stress: string;
    water_security: string;
    summary_tag: string;
  };
  monthly_drought_risk: {
    scale: string[];
    current_month_risk: string;
    series: {
      month: string;
      month_num: number;
      risk_level: string;
      risk_score: number;
      status_color: string;
    }[];
  };
  flood_risk_forecast: {
    window: string;
    overall_flood_probability: string;
    days: {
      day: string;
      date: string;
      weekday: string;
      rainfall_mm: number;
      flood_probability_pct: number;
      flood_probability: string;
      warning: string;
    }[];
  };
  provenance: Provenance;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function ClimatePage() {
  const today = new Date();
  const [district, setDistrict] = useState("Anuradhapura");
  const [end, setEnd] = useState(iso(new Date(today.getTime() - 5 * 864e5)));
  const [start, setStart] = useState(iso(new Date(today.getTime() - 185 * 864e5)));

  // Module 1: National Climate Intelligence Engine query
  const engineQuery = useOrgQuery<ClimateEngineResponse>(
    ["climate-engine", district],
    `/intelligence/climate-engine?district=${encodeURIComponent(district)}`
  );

  const q = useOrgQuery<Daily>(
    ["climate-daily", district, start, end],
    `/climate/daily?district=${encodeURIComponent(district)}&start=${start}&end=${end}`
  );
  const maha = useOrgQuery<Season>(
    ["season", district, "maha"],
    `/climate/season-baseline?district=${encodeURIComponent(district)}&season=maha`
  );
  const yala = useOrgQuery<Season>(
    ["season", district, "yala"],
    `/climate/season-baseline?district=${encodeURIComponent(district)}&season=yala`
  );

  const eng = engineQuery.data;
  const score = eng?.district_climate_score;
  const drought = eng?.monthly_drought_risk;
  const flood = eng?.flood_risk_forecast;
  const s = q.data?.summary;

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan/30 bg-gradient-to-br from-panel/90 via-midnight/80 to-base/90 p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] glass-transmission">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-3.5 py-1 text-xs font-semibold text-cyan shadow-[0_0_15px_rgba(34,211,238,0.25)]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Module 1 · Operational Satellite Telemetry</span>
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-snow md:text-4xl">
              National Climate Intelligence Engine
            </h1>
            <p className="max-w-2xl text-sm text-muted">
              Autonomous meteorological synthesis delivering real-time district climate stability scores, 12-month drought vulnerability modeling, and 7-day flash-flood probability forecasting.
            </p>
          </div>

          <div className="flex w-full flex-col sm:w-72">
            <Label htmlFor="district-select">Select Target District</Label>
            <div className="mt-1">
              <DistrictSelect value={district} onChange={setDistrict} />
            </div>
            <span className="mt-1.5 text-right font-mono text-[11px] text-muted">
              Live Feed: {district} Zone
            </span>
          </div>
        </div>
      </div>

      {engineQuery.isError && <ErrorState error={engineQuery.error} onRetry={() => engineQuery.refetch()} />}

      {/* SECTION 1: DISTRICT CLIMATE SCORE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-snow">

            </h2>
            <p className="text-xs text-muted">
              Synthesized environmental health indices for {district}
            </p>
          </div>
          <DataTag kind="predicted" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Climate Stability */}
          <div className="card-3d glass-transmission rounded-2xl p-5 border border-line/60 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Climate Stability</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan/15 text-cyan border border-cyan/30">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-4xl font-extrabold text-snow">
                {score ? `${score.climate_stability_pct}%` : "68%"}
              </span>
              <span className="text-xs text-cyan font-medium">Optimal Band</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan to-emerald transition-all duration-1000"
                style={{ width: `${score?.climate_stability_pct ?? 68}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted">Multi-decadal seasonal variance stability</p>
          </div>

          {/* Rainfall Deviation */}
          <div className="card-3d glass-transmission rounded-2xl p-5 border border-line/60 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Rainfall Deviation</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber/15 text-amber border border-amber/30">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-4xl font-extrabold text-amber">
                {score ? `${score.rainfall_deviation_pct > 0 ? "+" : ""}${score.rainfall_deviation_pct}%` : "-12%"}
              </span>
              <span className="text-xs text-muted font-medium">vs 20-yr Normal</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line/60">
              <div
                className="h-full rounded-full bg-amber transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.abs(score?.rainfall_deviation_pct ?? 12) * 4)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted">Deficit relative to Maha seasonal average</p>
          </div>

          {/* Heat Stress */}
          <div className="card-3d glass-transmission rounded-2xl p-5 border border-line/60 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Heat Stress</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose/15 text-rose border border-rose/30">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold text-snow">
                {score?.heat_stress ?? "High"}
              </span>
              <span className="rounded-full bg-rose/20 px-2 py-0.5 text-[11px] font-semibold text-rose border border-rose/30">
                Alert
              </span>
            </div>
            <div className="mt-3 flex gap-1">
              {["Low", "Moderate", "High", "Critical"].map((lvl) => {
                const active = (score?.heat_stress ?? "High") === lvl;
                return (
                  <div
                    key={lvl}
                    className={`h-2 flex-1 rounded-full ${active ? "bg-rose shadow-[0_0_10px_rgba(251,113,133,0.5)]" : "bg-line/40"
                      }`}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted">Midday surface temperature spike index</p>
          </div>

          {/* Water Security */}
          <div className="card-3d glass-transmission rounded-2xl p-5 border border-line/60 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Water Security</span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald/15 text-emerald border border-emerald/30">
                <Droplets className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold text-snow">
                {score?.water_security ?? "Moderate"}
              </span>
              <span className="rounded-full bg-emerald/20 px-2 py-0.5 text-[11px] font-semibold text-emerald border border-emerald/30">
                Stable
              </span>
            </div>
            <div className="mt-3 flex gap-1">
              {["Critical", "Low", "Moderate", "High"].map((sec) => {
                const active = (score?.water_security ?? "Moderate") === sec;
                return (
                  <div
                    key={sec}
                    className={`h-2 flex-1 rounded-full ${active ? "bg-emerald shadow-[0_0_10px_rgba(52,211,153,0.5)]" : "bg-line/40"
                      }`}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted">Major tank storage & aquifer replenishment</p>
          </div>
        </div>
      </section>

      {/* SECTION 2: MONTHLY DROUGHT RISK */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-snow">
              Monthly Drought Risk
            </h2>
            <p className="text-xs text-muted">
              Annual 12-month vulnerability model across risk tiers: Very Low · Low · Moderate · High · Critical
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Current Month Status:</span>
            <span className="rounded-full border border-amber/40 bg-amber/15 px-3 py-0.5 text-xs font-semibold text-amber shadow-[0_0_10px_rgba(251,191,36,0.2)]">
              {drought?.current_month_risk ?? "Moderate"} Risk
            </span>
          </div>
        </div>

        <div className="card-3d glass-transmission rounded-2xl border border-line/60 p-5 md:p-6">
          {/* Risk Level Legend */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-snow">Risk Tiers:</span>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg bg-emerald/15 px-2.5 py-1 text-emerald border border-emerald/30 font-medium">Very Low</span>
              <span className="rounded-lg bg-cyan/15 px-2.5 py-1 text-cyan border border-cyan/30 font-medium">Low</span>
              <span className="rounded-lg bg-amber/15 px-2.5 py-1 text-amber border border-amber/30 font-medium">Moderate</span>
              <span className="rounded-lg bg-rose/15 px-2.5 py-1 text-rose border border-rose/30 font-medium">High</span>
              <span className="rounded-lg bg-red-950/80 px-2.5 py-1 text-red-400 border border-red-500/50 font-bold shadow-[0_0_10px_rgba(239,68,68,0.3)]">Critical</span>
            </div>
          </div>

          {/* 12-Month Matrix Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {drought?.series.map((item) => {
              const isCrit = item.risk_level === "Critical";
              const isHigh = item.risk_level === "High";
              const isMod = item.risk_level === "Moderate";
              const isLow = item.risk_level === "Low";
              const isCur = item.month_num === today.getMonth() + 1;

              return (
                <div
                  key={item.month}
                  className={`relative rounded-xl p-3.5 transition-all border ${isCur
                      ? "border-cyan bg-cyan/10 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                      : "border-line/40 bg-panel/40 hover:border-line hover:bg-panel/70"
                    }`}
                >
                  {isCur && (
                    <span className="absolute -top-2 right-2 rounded-full bg-cyan px-1.5 py-0.2 text-[9px] font-bold text-night">
                      CURRENT
                    </span>
                  )}
                  <p className="text-xs font-semibold text-snow">{item.month}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${isCrit ? "text-red-400" : isHigh ? "text-rose" : isMod ? "text-amber" : isLow ? "text-cyan" : "text-emerald"
                        }`}
                    >
                      {item.risk_level}
                    </span>
                    <span className="font-mono text-[11px] text-muted">{item.risk_score}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-base">
                    <div
                      className={`h-full rounded-full ${isCrit ? "bg-red-500" : isHigh ? "bg-rose" : isMod ? "bg-amber" : isLow ? "bg-cyan" : "bg-emerald"
                        }`}
                      style={{ width: `${item.risk_score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3: FLOOD RISK FORECAST */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-snow">
              Flood Risk Forecast
            </h2>
            <p className="text-xs text-muted">
              Next 7 Days hydro-meteorological projection for {district}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">7-Day Aggregate Risk:</span>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider border ${flood?.overall_flood_probability === "High"
                  ? "border-rose/50 bg-rose/20 text-rose"
                  : flood?.overall_flood_probability === "Medium"
                    ? "border-amber/50 bg-amber/20 text-amber"
                    : "border-emerald/50 bg-emerald/20 text-emerald"
                }`}
            >
              {flood?.overall_flood_probability ?? "Low"} Flood Probability
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          {flood?.days.map((d) => {
            const isHigh = d.flood_probability === "High";
            const isMed = d.flood_probability === "Medium";

            return (
              <div
                key={d.day}
                className="card-3d glass-transmission rounded-2xl border border-line/60 p-4 transition-all hover:border-cyan/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-snow">{d.day}</span>
                  <span className="font-mono text-[11px] text-muted">{d.weekday}</span>
                </div>
                <div className="mt-3">
                  <span className="font-mono text-[11px] text-muted block">Expected Precip</span>
                  <span className="font-display text-2xl font-extrabold text-cyan">
                    {d.rainfall_mm} <span className="text-xs font-normal text-muted">mm</span>
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-line/40">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Probability:</span>
                    <span
                      className={`font-semibold ${isHigh ? "text-rose" : isMed ? "text-amber" : "text-emerald"
                        }`}
                    >
                      {d.flood_probability}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-base">
                    <div
                      className={`h-full rounded-full ${isHigh ? "bg-rose" : isMed ? "bg-amber" : "bg-emerald"
                        }`}
                      style={{ width: `${d.flood_probability_pct}%` }}
                    />
                  </div>
                  <span className="mt-2 block truncate text-[10px] text-muted/80">{d.warning}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 4: HISTORICAL OBSERVATIONS & CLIMATOLOGY */}
      <section className="space-y-4 pt-4 border-t border-line/60">
        <h2 className="font-display text-xl font-bold tracking-tight text-snow">
          Historical Climate Normals & Daily Series
        </h2>

        {/* Date Filter Bar */}
        <div className="panel grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="s">Historical Start Date</Label>
            <input
              id="s"
              type="date"
              className="field"
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="e">Historical End Date</Label>
            <input
              id="e"
              type="date"
              className="field"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        {/* Daily Stats Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Total rainfall" value={s ? `${fmt(s.total_precip_mm)} mm` : "…"} />
          <Stat label="Mean temperature" value={s ? `${fmt(s.mean_temp_c, 1)} °C` : "…"} />
          <Stat label="Hottest day (max)" value={s ? `${fmt(s.max_temp_c, 1)} °C` : "…"} />
          <Stat label="Heavy-rain days" value={s ? fmt(s.heavy_rain_days_50mm) : "…"} sub="≥ 50 mm in a day" />
          <Stat
            label="Dry days"
            value={s ? fmt(s.dry_days_lt1mm) : "…"}
            sub={s?.missing_days ? `${s.missing_days} days missing in source` : "< 1 mm"}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Daily temperature" tag="historical">
            {q.isLoading ? (
              <Skeleton h={260} />
            ) : (
              q.data && (
                <div className="h-64">
                  <ResponsiveContainer>
                    <LineChart data={q.data.series}>
                      <CartesianGrid {...grid} vertical={false} />
                      <XAxis dataKey="date" {...axis} minTickGap={40} tickFormatter={(d) => d.slice(5)} />
                      <YAxis {...axis} unit="°" width={40} domain={["auto", "auto"]} />
                      <Tooltip {...tooltip} />
                      <Legend />
                      <Line dataKey="t2m_max" name="Max" stroke={C.amber} dot={false} />
                      <Line dataKey="t2m" name="Mean" stroke={C.emerald} dot={false} strokeWidth={2} />
                      <Line dataKey="t2m_min" name="Min" stroke={C.cyan} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )
            )}
          </Panel>

          <Panel title="Daily rainfall" tag="historical">
            {q.isLoading ? (
              <Skeleton h={260} />
            ) : (
              q.data && (
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={q.data.series}>
                      <CartesianGrid {...grid} vertical={false} />
                      <XAxis dataKey="date" {...axis} minTickGap={40} tickFormatter={(d) => d.slice(5)} />
                      <YAxis {...axis} unit=" mm" width={50} />
                      <Tooltip {...tooltip} />
                      <Bar dataKey="precip_mm" name="Rainfall (mm)" fill={C.cyan} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            )}
          </Panel>
        </div>

        {/* Seasonal Normals Panel */}
        <Panel title="Seasonal climate normals (2001–2020)" tag="historical">
          <div className="grid gap-4 sm:grid-cols-2">
            {[["Maha", maha], ["Yala", yala]].map(([n, x]) => {
              const d = (x as typeof maha).data;
              return (
                <div key={n as string} className="rounded-xl border border-line/60 bg-panel/40 p-4">
                  <p className="font-semibold text-snow">{n as string} season</p>
                  {d ? (
                    <p className="mt-2 text-sm text-muted">
                      Mean temperature <span className="text-snow font-mono tabular">{fmt(d.mean_temp_c, 1)} °C</span>, total
                      rainfall <span className="text-snow font-mono tabular">{fmt(d.rainfall_mm)} mm</span>
                      {d.elevation_m != null && <>, grid-cell elevation {fmt(d.elevation_m)} m</>}
                    </p>
                  ) : (x as typeof maha).isError ? (
                    <p className="mt-2 text-sm text-rose">{((x as typeof maha).error as Error).message}</p>
                  ) : (
                    <Skeleton h={40} />
                  )}
                </div>
              );
            })}
          </div>
          <ProvenanceNote p={maha.data?.provenance || eng?.provenance} />
        </Panel>
      </section>
    </div>
  );
}
