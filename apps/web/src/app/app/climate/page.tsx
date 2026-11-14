"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import DistrictSelect from "@/components/app/DistrictSelect";
import { axis, C, grid, tooltip } from "@/components/app/charts";
import { ErrorState, Label, Panel, ProvenanceNote, Skeleton, Stat } from "@/components/ui/kit";
import { fmt, useOrgQuery } from "@/lib/hooks";
import type { Provenance } from "@/lib/types";

type Daily = { series: { date: string; t2m: number | null; t2m_max: number | null; t2m_min: number | null; precip_mm: number | null; rh2m: number | null; solar_kwh_m2: number | null; wind_ms: number | null }[];
  summary: { total_precip_mm: number | null; mean_temp_c: number | null; max_temp_c: number | null; heavy_rain_days_50mm: number; dry_days_lt1mm: number; missing_days: number }; provenance: Provenance };
type Season = { mean_temp_c: number; rainfall_mm: number; elevation_m: number | null; provenance: Provenance };

const iso = (d: Date) => d.toISOString().slice(0, 10);
export default function Climate() {
  const today = new Date();
  const [district, setDistrict] = useState("Monaragala");
  const [end, setEnd] = useState(iso(new Date(today.getTime() - 5 * 864e5)));
  const [start, setStart] = useState(iso(new Date(today.getTime() - 185 * 864e5)));
  const q = useOrgQuery<Daily>(["climate", district, start, end], `/climate/daily?district=${encodeURIComponent(district)}&start=${start}&end=${end}`);
  const maha = useOrgQuery<Season>(["season", district, "maha"], `/climate/season-baseline?district=${encodeURIComponent(district)}&season=maha`);
  const yala = useOrgQuery<Season>(["season", district, "yala"], `/climate/season-baseline?district=${encodeURIComponent(district)}&season=yala`);
  const s = q.data?.summary;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-3xl font-semibold">Climate intelligence</h1>
      <div className="panel grid gap-4 p-4 sm:grid-cols-3">
        <div><Label htmlFor="district">District</Label><DistrictSelect value={district} onChange={setDistrict} /></div>
        <div><Label htmlFor="s">From</Label><input id="s" type="date" className="field" value={start} max={end} onChange={(e) => setStart(e.target.value)} /></div>
        <div><Label htmlFor="e">To</Label><input id="e" type="date" className="field" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Total rainfall" value={s ? `${fmt(s.total_precip_mm)} mm` : "…"} />
        <Stat label="Mean temperature" value={s ? `${fmt(s.mean_temp_c, 1)} °C` : "…"} />
        <Stat label="Hottest day (max)" value={s ? `${fmt(s.max_temp_c, 1)} °C` : "…"} />
        <Stat label="Heavy-rain days" value={s ? fmt(s.heavy_rain_days_50mm) : "…"} sub="≥ 50 mm in a day" />
        <Stat label="Dry days" value={s ? fmt(s.dry_days_lt1mm) : "…"} sub={s?.missing_days ? `${s.missing_days} days missing in source` : "< 1 mm"} />
      </div>
      <Panel title="Daily temperature" tag="historical">
        {q.isLoading ? <Skeleton h={260} /> : q.data && <div className="h-64"><ResponsiveContainer><LineChart data={q.data.series}>
          <CartesianGrid {...grid} vertical={false} /><XAxis dataKey="date" {...axis} minTickGap={40} tickFormatter={(d) => d.slice(5)} /><YAxis {...axis} unit="°" width={40} domain={["auto", "auto"]} />
          <Tooltip {...tooltip} /><Legend />
          <Line dataKey="t2m_max" name="Max" stroke={C.amber} dot={false} /><Line dataKey="t2m" name="Mean" stroke={C.emerald} dot={false} strokeWidth={2} /><Line dataKey="t2m_min" name="Min" stroke={C.cyan} dot={false} />
        </LineChart></ResponsiveContainer></div>}
      </Panel>
      <Panel title="Daily rainfall" tag="historical">
        {q.isLoading ? <Skeleton h={220} /> : q.data && <><div className="h-56"><ResponsiveContainer><BarChart data={q.data.series}>
          <CartesianGrid {...grid} vertical={false} /><XAxis dataKey="date" {...axis} minTickGap={40} tickFormatter={(d) => d.slice(5)} /><YAxis {...axis} unit=" mm" width={50} />
          <Tooltip {...tooltip} /><Bar dataKey="precip_mm" name="Rainfall (mm)" fill={C.cyan} />
        </BarChart></ResponsiveContainer></div><ProvenanceNote p={q.data.provenance} /></>}
      </Panel>
      <Panel title="Seasonal climate normals (2001–2020)" tag="historical">
        <div className="grid gap-4 sm:grid-cols-2">
          {[["Maha", maha], ["Yala", yala]].map(([n, x]) => {
            const d = (x as typeof maha).data;
            return <div key={n as string} className="rounded-xl border border-line p-4"><p className="font-semibold">{n as string} season</p>
              {d ? <p className="mt-2 text-sm text-muted">Mean temperature <span className="text-ink tabular">{fmt(d.mean_temp_c, 1)} °C</span>, total rainfall <span className="text-ink tabular">{fmt(d.rainfall_mm)} mm</span>{d.elevation_m != null && <>, grid-cell elevation {fmt(d.elevation_m)} m</>}</p>
                : (x as typeof maha).isError ? <p className="mt-2 text-sm text-rose">{((x as typeof maha).error as Error).message}</p> : <Skeleton h={40} />}</div>;
          })}
        </div>
        <ProvenanceNote p={maha.data?.provenance} />
      </Panel>
      <p className="text-xs text-muted">No forecast provider is configured, so this page shows observations and climatology only.</p>
    </div>
  );
}
