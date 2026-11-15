"use client";
/** Merges live AgriIntel API data (NASA POWER-backed) into a demo DistrictIntel. Used in the signed-in dashboard. */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { opportunityOf, type CropKey, type DistrictIntel, type Season } from "./model";

type Anomaly = { anomaly_pct: number | null; observed_mm: number; normal_mm: number; start: string; end: string };
type Baseline = { mean_temp_c: number; rainfall_mm: number };
type Soil = { summary: { latest_root_zone: number | null } };
type Rec = { ranking: { crop: string; score: number; water_balance: { demand_mm: number } }[]; avoid: string[] };

export function useLiveDistrict(name: string | null, season: Season, enabled: boolean) {
  const orgId = useAuth((s) => s.orgId);
  const on = enabled && !!orgId && !!name;
  const q = (k: string, path: string, init?: Parameters<typeof api>[1]) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({ queryKey: [orgId, "agrisphere", k, name, season], queryFn: () => api<unknown>(path, init), enabled: on, retry: 0, staleTime: 10 * 60_000 });
  const n = encodeURIComponent(name ?? "");
  const anomaly = q("anomaly", `/climate/anomaly?district=${n}&days=30`);
  const baseline = q("baseline", `/climate/season-baseline?district=${n}&season=${season}`);
  const soil = q("soil", `/soil/moisture?district=${n}`);
  const rec = q("rec", "/recommendations", { body: { district: name, season, irrigation: "none" } });
  const loading = [anomaly, baseline, soil, rec].some((x) => x.isLoading);
  const errors = [anomaly, baseline, soil, rec].filter((x) => x.isError).length;
  return { anomaly: anomaly.data as Anomaly | undefined, baseline: baseline.data as Baseline | undefined, soil: soil.data as Soil | undefined,
    rec: rec.data as Rec | undefined, loading, errors };
}

export function mergeLive(d: DistrictIntel, live: ReturnType<typeof useLiveDistrict>): DistrictIntel {
  const out: DistrictIntel = structuredClone(d);
  if (live.anomaly?.anomaly_pct != null) {
    out.climate.rainfallDeviation = { v: Math.round(live.anomaly.anomaly_pct), src: "live",
      note: `Last 30 days (${live.anomaly.start} to ${live.anomaly.end}): ${live.anomaly.observed_mm} mm vs ${live.anomaly.normal_mm} mm normal. NASA POWER.` };
  }
  if (live.baseline) {
    out.climate.meanTempC = { v: live.baseline.mean_temp_c, src: "live", note: "2001–2020 seasonal normal, NASA POWER" };
    out.climate.seasonRainMm = { v: live.baseline.rainfall_mm, src: "live", note: "2001–2020 seasonal normal, NASA POWER" };
  }
  if (live.soil?.summary.latest_root_zone != null) {
    out.water.rootZoneWetness = { v: live.soil.summary.latest_root_zone, src: "live", note: "MERRA-2 root-zone wetness via NASA POWER (~50 km cell)" };
  }
  if (live.rec) {
    const byCrop = new Map(live.rec.ranking.map((r) => [r.crop, r]));
    out.crops = {
      src: "mixed", note: "Suitability and water need are live (NASA POWER climatology + rules model); yield, market and price values are demo.",
      v: out.crops.v.map((c) => {
        const r = byCrop.get(c.crop);
        if (!r) return c;
        const next = { ...c, suitability: Math.round(r.score), waterMm: Math.round(r.water_balance.demand_mm) };
        return { ...next, opportunity: opportunityOf(next) };
      }).sort((a, b) => b.opportunity - a.opportunity),
    };
    out.avoid = { v: live.rec.avoid as CropKey[], src: "live", note: "Rules model on NASA POWER climatology" };
  }
  return out;
}
