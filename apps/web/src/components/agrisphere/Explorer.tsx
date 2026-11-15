"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { ChevronRight } from "lucide-react";
import SriLankaMap, { colorScale, type AdminFC } from "./SriLankaMap";
import DistrictPanel, { SrcTag } from "./DistrictPanel";
import { cropName, demoDistrict, METRICS, SEASON_INFO, type DistrictIntel, type Metric, type Season } from "@/lib/agrisphere/model";
import { mergeLive, useLiveDistrict } from "@/lib/agrisphere/live";
import { mergeNasaIntoDistrict } from "@/lib/agrisphere/nasa-adapter";
import { useNasaDistrict } from "@/components/nasa/useNasaDistrict";

type Geo = { provinces: AdminFC; districts: AdminFC };
const loadGeo = async (): Promise<Geo> => {
  const t = (await fetch("/geo/lk-admin.topo.json").then((r) => { if (!r.ok) throw new Error("Map boundaries failed to load"); return r.json(); })) as Topology;
  return { provinces: feature(t, t.objects.provinces) as unknown as AdminFC, districts: feature(t, t.objects.districts) as unknown as AdminFC };
};
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/**
 * mode "live": signed-in dashboard; merges NASA-backed API data for the selected district.
 * mode "demo": public website; everything is illustrative and labelled as such.
 */
export default function Explorer({ mode = "demo" }: { mode?: "live" | "demo" }) {
  const geo = useQuery({ queryKey: ["lk-admin-geo"], queryFn: loadGeo, staleTime: Infinity });
  const [season, setSeason] = useState<Season>(() => ([4, 5, 6, 7, 8].includes(new Date().getMonth() + 1) ? "yala" : "maha"));
  const [metric, setMetric] = useState<Metric>("opportunity");
  const [provinceId, setProvinceId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);

  // Escape walks back up a level
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== "Escape") return; if (districtId) setDistrictId(null); else if (provinceId) setProvinceId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [districtId, provinceId]);

  const national = useMemo<DistrictIntel[]>(() => geo.data?.districts.features.map((f) =>
    demoDistrict(f.properties.id, f.properties.name, f.properties.province_id!, season)) ?? [], [geo.data, season]);

  const sel = national.find((d) => d.id === districtId) ?? null;
  const live = useLiveDistrict(sel?.name ?? null, season, mode === "live");
  const nasa = useNasaDistrict(sel?.name ?? null);
  const selected = useMemo(() => {
    if (!sel) return null;
    const withNasa = nasa.dataset && nasa.district ? mergeNasaIntoDistrict(sel, nasa.dataset) : sel;
    return mode === "live" ? mergeLive(withNasa, live) : withNasa;
  }, [sel, nasa.dataset, nasa.district, live, mode]);

  const m = METRICS[metric];
  const values = useMemo(() => {
    const v: Record<string, number> = {};
    national.forEach((d) => { v[d.id] = m.get(d); });
    geo.data?.provinces.features.forEach((p) => { v[p.properties.id] = avg(national.filter((d) => d.provinceId === p.properties.id).map(m.get)); });
    if (selected) v[selected.id] = m.get(selected);
    return v;
  }, [national, geo.data, m, selected]);

  const prov = geo.data?.provinces.features.find((p) => p.properties.id === provinceId);
  const distFeature = geo.data?.districts.features.find((f) => f.properties.id === districtId);
  const pickProvince = (id: string | null) => { setProvinceId(id); setDistrictId(null); };
  const pickDistrict = (id: string) => {
    const f = geo.data?.districts.features.find((x) => x.properties.id === id);
    if (f && f.properties.province_id !== provinceId) setProvinceId(f.properties.province_id!);
    setDistrictId(id);
  };

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Location" className="flex min-w-0 flex-1 items-center gap-1 text-sm">
          <button onClick={() => pickProvince(null)} className={provinceId ? "text-muted hover:text-ink" : "font-semibold"}>Sri Lanka</button>
          {prov && <><ChevronRight className="h-4 w-4 text-muted" /><button onClick={() => setDistrictId(null)} className={districtId ? "text-muted hover:text-ink" : "font-semibold"}>{prov.properties.name} Province</button></>}
          {distFeature && <><ChevronRight className="h-4 w-4 text-muted" /><span className="font-semibold">{distFeature.properties.name}</span></>}
        </nav>
        <div role="radiogroup" aria-label="Season" className="flex rounded-full border border-line p-0.5 text-sm">
          {(["maha", "yala"] as const).map((s) => (
            <button key={s} role="radio" aria-checked={season === s} onClick={() => setSeason(s)}
              className={`rounded-full px-4 py-1 ${season === s ? "bg-emerald text-abyss font-semibold" : "text-muted hover:text-ink"}`}>{SEASON_INFO[s].name}</button>))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">Colour by
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="field !w-auto !py-1.5">
            {(Object.keys(METRICS) as Metric[]).map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
          </select></label>
      </div>

      {mode === "demo" && (
        <p className="rounded-xl border border-rose/30 bg-rose/5 px-4 py-2 text-sm">
          <span className="font-semibold text-rose">Demo preview.</span> Values are illustrative so you can explore the experience. Signed-in workspaces load live NASA data where it&apos;s connected; every value shows its source.
        </p>)}

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,5fr)_7fr]">
        {/* map */}
        <div className="panel relative h-[62vh] min-h-[420px] overflow-hidden lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
          {geo.isLoading && <div className="skeleton absolute inset-4" />}
          {geo.isError && <p className="p-6 text-sm text-rose">The map boundaries couldn&apos;t load. Check that /geo/lk-admin.topo.json is deployed.</p>}
          {geo.data && (
            <SriLankaMap provinces={geo.data.provinces} districts={geo.data.districts} values={values} good={m.good} metricLabel={m.label}
              provinceId={provinceId} districtId={districtId} onProvince={pickProvince} onDistrict={pickDistrict} />)}
          {provinceId && <button onClick={() => pickProvince(null)} className="btn btn-ghost glass absolute right-3 top-3 !py-1.5 text-sm">Back to all provinces</button>}
          <p className="absolute bottom-2 right-3 text-[10px] text-muted">Boundaries: lk_admin_regions (DCS, HDX), MIT</p>
        </div>

        {/* panel */}
        <div className="min-w-0">
          {!provinceId && geo.data && <NationalView geo={geo.data} national={national} values={values} metric={metric} season={season} onProvince={pickProvince} onDistrict={pickDistrict} />}
          {provinceId && !districtId && geo.data && prov && (
            <ProvinceView name={prov.properties.name} otherNames={prov.properties.other_names} area={prov.properties.area_sqkm}
              districts={national.filter((d) => d.provinceId === provinceId)} metric={metric} values={values} onDistrict={pickDistrict} />)}
          {selected && distFeature && prov && (
            <DistrictPanel key={selected.id + season} d={selected} otherNames={distFeature.properties.other_names} provinceName={prov.properties.name}
              areaKm2={distFeature.properties.area_sqkm} national={national} liveState={mode === "live" ? live : null}
              nasaState={nasa} />)}
        </div>
      </div>
    </div>
  );
}

function NationalView({ geo, national, values, metric, season, onProvince, onDistrict }: {
  geo: Geo; national: DistrictIntel[]; values: Record<string, number>; metric: Metric; season: Season;
  onProvince: (id: string) => void; onDistrict: (id: string) => void;
}) {
  const m = METRICS[metric];
  const provinces = geo.provinces.features.map((p) => p.properties).sort((a, b) => (m.good ? values[b.id] - values[a.id] : values[a.id] - values[b.id]));
  const color = colorScale(provinces.map((p) => values[p.id]), m.good);
  const best = national.slice().sort((a, b) => b.crops.v[0].opportunity - a.crops.v[0].opportunity).slice(0, 3);
  const water = national.slice().sort((a, b) => b.water.index.v - a.water.index.v)[0];
  const risk = national.slice().sort((a, b) => b.insurance.overall.v - a.insurance.overall.v)[0];
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-4xl font-semibold">{SEASON_INFO[season].name} season across Sri Lanka</h2>
        <p className="mt-2 max-w-xl text-muted">Choose a province on the map to see its districts, then a district for its full decision package: what, where, when and how much to grow, with expected profit, risk, demand and harvest.</p>
      </header>
      <div className="panel p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Highest opportunity this season</h3><SrcTag src="demo" /></div>
        <ol className="grid gap-3 sm:grid-cols-3">{best.map((d, i) => (
          <li key={d.id}><button onClick={() => onDistrict(d.id)} className="w-full rounded-xl border border-line p-3 text-left hover:border-emerald">
            <p className="text-xs text-muted">{i + 1}. {d.name}</p><p className="font-display text-lg font-semibold">{cropName(d.crops.v[0].crop)}</p>
            <p className="tabular text-sm text-emerald">{d.crops.v[0].opportunity} / 100</p></button></li>))}</ol>
        <p className="mt-3 text-sm text-muted">Most water available: <button onClick={() => onDistrict(water.id)} className="text-ink hover:text-cyan">{water.name}</button>. Highest insurance risk: <button onClick={() => onDistrict(risk.id)} className="text-ink hover:text-cyan">{risk.name}</button>.</p>
      </div>
      <div className="panel p-5">
        <h3 className="mb-3 font-semibold">Provinces by {m.label.toLowerCase()}</h3>
        <ul className="divide-y divide-line">{provinces.map((p) => {
          const ds = national.filter((d) => d.provinceId === p.id);
          return (
            <li key={p.id}><button onClick={() => onProvince(p.id)} className="grid w-full grid-cols-[14px_1fr_auto] items-center gap-3 py-2.5 text-left hover:text-cyan">
              <span className="h-3 w-3 rounded-sm" style={{ background: color(values[p.id]) }} />
              <span><span className="font-medium">{p.name}</span><span className="block text-xs text-muted">{ds.length} districts: {ds.map((d) => d.name).join(", ")}</span></span>
              <span className="tabular font-semibold">{values[p.id]}</span></button></li>);
        })}</ul>
      </div>
    </div>
  );
}

function ProvinceView({ name, otherNames, area, districts, metric, values, onDistrict }: {
  name: string; otherNames: string; area: number; districts: DistrictIntel[]; metric: Metric; values: Record<string, number>; onDistrict: (id: string) => void;
}) {
  const m = METRICS[metric];
  const sorted = districts.slice().sort((a, b) => (m.good ? values[b.id] - values[a.id] : values[a.id] - values[b.id]));
  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">{otherNames.split(",").join(" / ")}</p>
        <h2 className="text-4xl font-semibold">{name} Province</h2>
        <p className="mt-1 text-sm text-muted">{districts.length} districts, {Math.round(area).toLocaleString()} km². Select a district on the map or below.</p>
      </header>
      <div className="panel overflow-x-auto p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Districts</h3><SrcTag src="demo" /></div>
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="text-left text-muted"><th className="pb-2 font-normal">District</th><th className="font-normal">Zone</th><th className="font-normal">Leading crop</th>
            <th className="font-normal">Opportunity</th><th className="font-normal">Water</th><th className="font-normal">Insurance risk</th></tr></thead>
          <tbody>{sorted.map((d) => (
            <tr key={d.id} onClick={() => onDistrict(d.id)} className="cursor-pointer border-t border-line hover:bg-panel-2">
              <td className="py-2.5"><button onClick={() => onDistrict(d.id)} className="font-medium hover:text-cyan">{d.name}</button></td>
              <td className="text-muted">{d.zone}</td><td>{cropName(d.crops.v[0].crop)}</td>
              <td className="tabular font-semibold text-emerald">{d.crops.v[0].opportunity}</td><td className="tabular">{d.water.index.v}</td>
              <td className={`tabular ${d.insurance.overall.v >= 60 ? "text-rose" : d.insurance.overall.v >= 35 ? "text-amber" : ""}`}>{d.insurance.overall.v}</td>
            </tr>))}</tbody></table>
      </div>
    </div>
  );
}
