"use client";
import { useState } from "react";
import { CartesianGrid, ComposedChart, Bar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine } from "recharts";
import DistrictSelect from "@/components/app/DistrictSelect";
import { axis, C, grid, tooltip } from "@/components/app/charts";
import { ErrorState, Panel, ProvenanceNote, Skeleton, Stat } from "@/components/ui/kit";
import { fmt, useOrgQuery } from "@/lib/hooks";
import type { Provenance } from "@/lib/types";

type Soil = { series: { date: string; surface: number | null; root_zone: number | null }[]; summary: { root_zone_mean: number | null; latest_root_zone: number | null; days_below_0_3: number; water_stress: string | null }; provenance: Provenance; smap_status: { product: string; status: string; message: string } };
type Daily = { series: { date: string; precip_mm: number | null }[] };

export default function SoilPage() {
  const [district, setDistrict] = useState("Polonnaruwa");
  const soil = useOrgQuery<Soil>(["soil", district], `/soil/moisture?district=${encodeURIComponent(district)}`);
  const rain = useOrgQuery<Daily>(["daily90", district], `/climate/daily?district=${encodeURIComponent(district)}`);
  const merged = soil.data?.series.map((s) => ({ ...s, precip_mm: rain.data?.series.find((r) => r.date === s.date)?.precip_mm ?? null }));
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><h1 className="text-3xl font-semibold">Soil and water intelligence</h1><div className="w-60"><DistrictSelect value={district} onChange={setDistrict} /></div></div>
      {soil.isError && <ErrorState error={soil.error} onRetry={() => soil.refetch()} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Latest root-zone wetness" value={fmt(soil.data?.summary.latest_root_zone, 2)} sub="0 = dry, 1 = saturated" />
        <Stat label="90-day mean" value={fmt(soil.data?.summary.root_zone_mean, 2)} />
        <Stat label="Days below 0.3" value={fmt(soil.data?.summary.days_below_0_3)} sub="Indicator of crop water stress" />
        <Stat label="Water stress" value={<span className="capitalize">{soil.data?.summary.water_stress ?? "—"}</span>} />
      </div>
      <Panel title="Rainfall versus soil wetness" tag="historical">
        {soil.isLoading ? <Skeleton h={280} /> : merged && <div className="h-72"><ResponsiveContainer><ComposedChart data={merged}>
          <CartesianGrid {...grid} vertical={false} /><XAxis dataKey="date" {...axis} minTickGap={40} tickFormatter={(d) => d.slice(5)} />
          <YAxis yAxisId="w" {...axis} domain={[0, 1]} width={40} /><YAxis yAxisId="r" orientation="right" {...axis} unit=" mm" width={50} />
          <Tooltip {...tooltip} /><Legend />
          <ReferenceLine yAxisId="w" y={0.3} stroke={C.amber} strokeDasharray="4 4" label={{ value: "stress threshold", fill: C.amber, fontSize: 11, position: "insideBottomLeft" }} />
          <Bar yAxisId="r" dataKey="precip_mm" name="Rainfall (mm)" fill={C.cyan} opacity={0.5} />
          <Line yAxisId="w" dataKey="root_zone" name="Root zone" stroke={C.emerald} dot={false} strokeWidth={2} />
          <Line yAxisId="w" dataKey="surface" name="Surface" stroke={C.slate} dot={false} />
        </ComposedChart></ResponsiveContainer></div>}
        <ProvenanceNote p={soil.data?.provenance} />
      </Panel>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Irrigation planning">
          <p className="text-sm text-muted">Seasonal water demand, deficit and irrigation volume in cubic metres are calculated per crop in the Decision Simulator, using the district climate baseline and your irrigation availability.</p>
          <a href="/app/simulator" className="mt-3 inline-block text-sm text-cyan">Open the simulator</a>
        </Panel>
        <Panel title="SMAP satellite soil moisture">
          <p className="text-sm"><span className="font-semibold">{soil.data?.smap_status.product ?? "SPL3SMP_E"}</span>: {soil.data?.smap_status.status.replace("_", " ") ?? "not configured"}</p>
          <p className="mt-2 text-sm text-muted">{soil.data?.smap_status.message}</p>
        </Panel>
      </div>
    </div>
  );
}
