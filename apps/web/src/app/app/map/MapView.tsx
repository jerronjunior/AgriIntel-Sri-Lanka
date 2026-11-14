"use client";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import turfArea from "@turf/area";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Layers, Pause, Pencil, Play, Upload, X } from "lucide-react";
import { api, ApiError, download } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { fmt, useDistricts, useOrgQuery } from "@/lib/hooks";
import type { District, Provenance } from "@/lib/types";
import { DataTag, ErrorState, Label, ProvenanceNote } from "@/components/ui/kit";

type Layer = { id: string; name: string; kind: string; unit: string; available: boolean; unavailable_reason: string | null; warning: string | null; provenance: Provenance | null };
type Snapshot = { district: District; climate: { rain_30d_mm: number; mean_temp_c: number | null; start: string; end: string } | null; soil: { root_zone_latest: number | null } | null; errors: Record<string, string>; provenance: Provenance[] };
type DailyResp = { series: { date: string; precip_mm: number | null }[] };

// MapLibre 6 ships an ES-module worker; serve it from /public so Next.js bundling can't break its URL.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const BOUNDS: [[number, number], [number, number]] = [[79.4, 5.7], [82.1, 10.0]];

function style(basemap: "imagery" | "outline"): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: basemap === "imagery" ? { imagery: { type: "raster", tiles: [ESRI], tileSize: 256, maxzoom: 18, attribution: "Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community" } } : {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": "#030B14" } }, ...(basemap === "imagery" ? [{ id: "imagery", type: "raster" as const, source: "imagery", paint: { "raster-saturation": -0.25, "raster-brightness-max": 0.85 } }] : [])],
  };
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } } }));
  return out;
}

export default function MapView() {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const drawingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<"imagery" | "outline">("imagery");
  const [selected, setSelected] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [rainOn, setRainOn] = useState(false);
  const [rainOpacity, setRainOpacity] = useState(0.75);
  const [rain, setRain] = useState<{ dates: string[]; byDistrict: Record<string, Record<string, number | null>> } | null>(null);
  const [rainLoading, setRainLoading] = useState(false);
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const sp = useSearchParams();
  const qc = useQueryClient();
  const orgId = useAuth((s) => s.orgId);
  const districts = useDistricts();
  const layers = useOrgQuery<{ items: Layer[] }>(["layers"], "/satellite/layers");
  const farms = useOrgQuery<GeoJSON.FeatureCollection>(["farms-geo"], "/farms/export.geojson");
  const snap = useOrgQuery<Snapshot>(["snap", selected], `/satellite/district-snapshot?district=${encodeURIComponent(selected ?? "")}`, !!selected);
  const outline = useQuery({ queryKey: ["lk-outline"], queryFn: () => fetch("/geo/sri-lanka.json").then((r) => r.json()), staleTime: Infinity });
  const provinces = useMemo(() => [...new Set(districts.data?.items.map((d) => d.province))], [districts.data]);

  // ---- init map (re-created when the basemap changes)
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({ container: el.current, style: style(basemap), bounds: BOUNDS, fitBoundsOptions: { padding: 30 }, maxBounds: [[76, 3], [86, 12.5]], attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    // "style.load" fires once our inline style is parsed, even if remote tiles or glyphs are slow or blocked.
    const markReady = () => setReady(true);
    m.once("style.load", markReady);
    m.once("load", markReady);
    m.on("click", (e) => { if (drawingRef.current) setDraft((d) => [...d, [e.lngLat.lng, e.lngLat.lat]]); });
    map.current = m;
    return () => { setReady(false); m.remove(); map.current = null; };
  }, [basemap]);

  // ---- data layers
  const setData = useCallback((id: string, data: GeoJSON.GeoJSON, add: (m: MLMap) => void) => {
    const m = map.current;
    if (!m || !ready) return;
    const src = m.getSource(id) as GeoJSONSource | undefined;
    if (src) src.setData(data); else { m.addSource(id, { type: "geojson", data }); add(m); }
  }, [ready]);

  useEffect(() => {
    if (!outline.data) return;
    setData("lk", outline.data, (m) => m.addLayer({ id: "lk-line", type: "line", source: "lk", paint: { "line-color": "#22D3EE", "line-width": 1.4, "line-opacity": 0.8 } }));
  }, [outline.data, setData]);

  useEffect(() => {
    if (!farms.data) return;
    setData("farms", farms.data, (m) => {
      m.addLayer({ id: "farm-fill", type: "fill", source: "farms", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#10B981", "fill-opacity": 0.25 } });
      m.addLayer({ id: "farm-line", type: "line", source: "farms", filter: ["==", "$type", "Polygon"], paint: { "line-color": "#10B981", "line-width": 2 } });
      m.addLayer({ id: "farm-pt", type: "circle", source: "farms", filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#10B981", "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });
      const pop = (e: maplibregl.MapLayerMouseEvent) => {
        const p = e.features?.[0]?.properties as { name: string; district: string; area_ha: number | null; irrigation: string } | undefined;
        if (!p || drawingRef.current) return;
        new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<strong>${p.name}</strong><br/>${p.district}${p.area_ha && p.area_ha !== null && String(p.area_ha) !== "null" ? `, ${(+p.area_ha).toFixed(2)} ha` : ""}<br/>Irrigation: ${p.irrigation}`).addTo(m);
        setSelected(p.district);
      };
      m.on("click", "farm-fill", pop); m.on("click", "farm-pt", pop);
    });
  }, [farms.data, setData]);

  const rainValue = useCallback((name: string) => (rain ? rain.byDistrict[name]?.[rain.dates[day]] ?? null : null), [rain, day]);
  const districtFC = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: (districts.data?.items ?? []).map((d) => ({ type: "Feature", geometry: { type: "Point", coordinates: [d.lon, d.lat] },
      properties: { name: d.name, province: d.province, rain: rainOn ? rainValue(d.name) ?? -1 : -1, selected: d.name === selected } })),
  }), [districts.data, rainOn, rainValue, selected]);

  useEffect(() => {
    setData("districts", districtFC, (m) => {
      m.addLayer({ id: "rain-circle", type: "circle", source: "districts", filter: [">=", ["get", "rain"], 0], paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "rain"], 0, 4, 10, 14, 50, 34], "circle-color": ["interpolate", ["linear"], ["get", "rain"], 0, "#94A3B8", 5, "#22D3EE", 30, "#2563EB"],
        "circle-opacity": 0.75, "circle-blur": 0.2 } });
      m.addLayer({ id: "district-pt", type: "circle", source: "districts", paint: { "circle-radius": ["case", ["get", "selected"], 8, 5], "circle-color": ["case", ["get", "selected"], "#10B981", "#22D3EE"], "circle-stroke-color": "#030B14", "circle-stroke-width": 1.5 } });
      m.addLayer({ id: "district-label", type: "symbol", source: "districts", layout: { "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, 1.2], "text-font": ["Open Sans Semibold"] }, paint: { "text-color": "#F8FAFC", "text-halo-color": "#030B14", "text-halo-width": 1.2 } });
      m.on("click", "district-pt", (e) => { if (!drawingRef.current) setSelected((e.features?.[0]?.properties as { name: string }).name); });
      m.on("mouseenter", "district-pt", () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "district-pt", () => { m.getCanvas().style.cursor = ""; });
    });
  }, [districtFC, setData]);

  useEffect(() => { if (ready && map.current?.getLayer("rain-circle")) map.current.setPaintProperty("rain-circle", "circle-opacity", rainOpacity); }, [rainOpacity, ready, rain]);

  // ---- URL ?district=
  useEffect(() => {
    const d = sp.get("district");
    const hit = districts.data?.items.find((x) => x.name === d);
    if (hit && ready) { setSelected(hit.name); map.current?.flyTo({ center: [hit.lon, hit.lat], zoom: 9 }); }
  }, [sp, districts.data, ready]);

  // ---- drawing
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (drawing) m.doubleClickZoom.disable(); else m.doubleClickZoom.enable();
    m.getCanvas().style.cursor = drawing ? "crosshair" : "";
  }, [ready, drawing]);
  const draftPoly = useMemo<GeoJSON.Feature<GeoJSON.Polygon> | null>(() => draft.length >= 3 ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...draft, draft[0]]] } } : null, [draft]);
  useEffect(() => {
    const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [
      ...(draftPoly ? [draftPoly] : []), ...draft.map((c) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: c } })),
      ...(draft.length === 2 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: draft } }] : [])] };
    setData("draft", fc, (m) => {
      m.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#F59E0B", "fill-opacity": 0.25 } });
      m.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["!=", "$type", "Point"], paint: { "line-color": "#F59E0B", "line-width": 2, "line-dasharray": [2, 1] } });
      m.addLayer({ id: "draft-pt", type: "circle", source: "draft", filter: ["==", "$type", "Point"], paint: { "circle-radius": 4, "circle-color": "#F59E0B" } });
    });
  }, [draft, draftPoly, setData]);
  const draftHa = draftPoly ? turfArea(draftPoly) / 10000 : 0;
  const nearestDistrict = useMemo(() => {
    if (!draftPoly || !districts.data) return "";
    const [cx, cy] = draft.reduce(([a, b], [x, y]) => [a + x / draft.length, b + y / draft.length], [0, 0]);
    return districts.data.items.reduce((best, d) => (Math.hypot(d.lon - cx, d.lat - cy) < Math.hypot(best.lon - cx, best.lat - cy) ? d : best)).name;
  }, [draftPoly, draft, districts.data]);

  async function saveFarm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("/farms", { body: { name: f.get("name"), district: f.get("district"), irrigation: f.get("irrigation"), boundary: draftPoly!.geometry } });
      setDraft([]); setDrawing(false); setMsg("Farm saved.");
      qc.invalidateQueries({ queryKey: [orgId, "farms-geo"] }); qc.invalidateQueries({ queryKey: [orgId, "farms"] });
    } catch (err) { setMsg((err as ApiError).message); }
  }

  async function importFile(file: File) {
    try {
      const fc = JSON.parse(await file.text());
      const r = await api<{ created: number; errors: { index: number; error: string }[] }>("/farms/import.geojson", { body: fc });
      setMsg(`Imported ${r.created} farm(s)${r.errors.length ? `; ${r.errors.length} skipped: ${r.errors.slice(0, 3).map((x) => `#${x.index + 1} ${x.error}`).join("; ")}` : ""}.`);
      qc.invalidateQueries({ queryKey: [orgId, "farms-geo"] });
    } catch (err) { setMsg(err instanceof SyntaxError ? "That file isn't valid GeoJSON." : (err as ApiError).message); }
  }

  // ---- rainfall time series (NASA POWER, per district point)
  async function loadRain() {
    if (!districts.data) return;
    setRainLoading(true); setMsg(null);
    const end = new Date(Date.now() - 5 * 864e5), start = new Date(end.getTime() - 29 * 864e5);
    const q = `start=${start.toISOString().slice(0, 10)}&end=${end.toISOString().slice(0, 10)}`;
    const res = await pool(districts.data.items, 5, (d) => api<DailyResp>(`/climate/daily?district=${encodeURIComponent(d.name)}&${q}`));
    const byDistrict: Record<string, Record<string, number | null>> = {};
    let dates: string[] = [];
    res.forEach((r, i) => { if (r) { byDistrict[districts.data!.items[i].name] = Object.fromEntries(r.series.map((s) => [s.date, s.precip_mm])); if (r.series.length > dates.length) dates = r.series.map((s) => s.date); } });
    setRainLoading(false);
    if (!dates.length) { setRainOn(false); setMsg("Rainfall couldn't be loaded from NASA POWER right now. No values are shown in its place."); return; }
    const failed = res.filter((r) => !r).length;
    if (failed) setMsg(`${failed} district(s) failed to load and are not shown.`);
    setRain({ dates, byDistrict }); setDay(dates.length - 1);
  }
  useEffect(() => { if (rainOn && !rain && !rainLoading) loadRain(); }, [rainOn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing || !rain) return;
    const t = setInterval(() => setDay((d) => (d + 1) % rain.dates.length), 700);
    return () => clearInterval(t);
  }, [playing, rain]);

  const fly = (names: string[]) => {
    const pts = districts.data?.items.filter((d) => names.includes(d.name)) ?? [];
    if (!pts.length || !map.current) return;
    const b = new maplibregl.LngLatBounds();
    pts.forEach((p) => b.extend([p.lon, p.lat]));
    map.current.fitBounds(b, { padding: 80, maxZoom: 9 });
  };

  return (
    <div className="relative -m-4 h-[calc(100vh-4rem)] md:-m-6">
      <div className="absolute inset-0"><div ref={el} className="h-full w-full" role="region" aria-label="Map of Sri Lanka" /></div>

      {/* toolbar */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <select aria-label="Province" className="field glass !w-auto !py-1.5 text-sm" defaultValue="" onChange={(e) => fly(districts.data?.items.filter((d) => d.province === e.target.value).map((d) => d.name) ?? [])}>
          <option value="" disabled>Province</option>{provinces.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select aria-label="District" className="field glass !w-auto !py-1.5 text-sm" value={selected ?? ""} onChange={(e) => { setSelected(e.target.value); fly([e.target.value]); }}>
          <option value="" disabled>District</option>{districts.data?.items.map((d) => <option key={d.name}>{d.name}</option>)}
        </select>
        <button onClick={() => { setDrawing(!drawing); setDraft([]); }} className={`btn glass !py-1.5 text-sm ${drawing ? "!border-amber text-amber" : ""}`}><Pencil className="h-4 w-4" />{drawing ? "Cancel drawing" : "Draw farm boundary"}</button>
        <label className="btn glass cursor-pointer !py-1.5 text-sm"><Upload className="h-4 w-4" />Import GeoJSON<input type="file" accept=".geojson,.json,application/geo+json" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} /></label>
        <button onClick={() => download("/farms/export.geojson", "agriintel-farms.geojson").catch((e: ApiError) => setMsg(e.message))} className="btn glass !py-1.5 text-sm"><Download className="h-4 w-4" />Export</button>
        <button onClick={() => setPanelOpen(!panelOpen)} className="btn glass !py-1.5 text-sm"><Layers className="h-4 w-4" />Layers</button>
      </div>
      {msg && <div role="status" className="glass absolute left-3 top-16 z-10 flex max-w-md items-start gap-2 rounded-xl p-3 text-sm">{msg}<button aria-label="Dismiss" onClick={() => setMsg(null)}><X className="h-4 w-4" /></button></div>}

      {drawing && (
        <div className="glass absolute bottom-24 left-3 z-10 w-80 rounded-2xl p-4 text-sm">
          {!draftPoly ? <p>Click the map to place at least three corners of the farm boundary.</p> : (
            <form onSubmit={saveFarm} className="space-y-3">
              <p>Area: <span className="tabular font-semibold">{fmt(draftHa, 2)} ha</span> ({fmt(draftHa / 0.404686, 2)} acres)</p>
              <div><Label htmlFor="fn">Farm name</Label><input id="fn" name="name" required maxLength={200} className="field" /></div>
              <div><Label htmlFor="fd">District</Label><select id="fd" name="district" defaultValue={nearestDistrict} key={nearestDistrict} className="field">{districts.data?.items.map((d) => <option key={d.name}>{d.name}</option>)}</select></div>
              <div><Label htmlFor="fi">Irrigation</Label><select id="fi" name="irrigation" className="field"><option value="none">None</option><option value="partial">Partial</option><option value="full">Full</option></select></div>
              <div className="flex gap-2"><button className="btn btn-primary flex-1 !py-2">Save farm</button><button type="button" onClick={() => setDraft(draft.slice(0, -1))} className="btn btn-ghost !py-2">Undo point</button></div>
            </form>)}
        </div>
      )}

      {/* layers panel */}
      {panelOpen && (
        <aside className="glass absolute right-14 top-3 z-10 max-h-[calc(100%-1.5rem)] w-80 overflow-y-auto rounded-2xl p-4 text-sm">
          <p className="mb-2 font-semibold">Basemap</p>
          <div className="mb-4 grid grid-cols-2 gap-2">{(["imagery", "outline"] as const).map((b) => (
            <button key={b} onClick={() => setBasemap(b)} className={`rounded-lg border px-2 py-1.5 ${basemap === b ? "border-emerald bg-emerald/10" : "border-line"}`}>{b === "imagery" ? "Satellite imagery" : "Outline only"}</button>))}</div>
          <p className="mb-2 font-semibold">Data layers</p>
          {layers.isError && <ErrorState error={layers.error} />}
          <ul className="space-y-3">
            {layers.data?.items.map((l) => (
              <li key={l.id} className={l.available ? "" : "opacity-60"}>
                <div className="flex items-center gap-2">
                  {l.id === "rainfall_daily_point" ? <input id={l.id} type="checkbox" disabled={!l.available} checked={rainOn} onChange={(e) => setRainOn(e.target.checked)} className="accent-emerald" />
                    : <input id={l.id} type="checkbox" disabled className="accent-emerald" />}
                  <label htmlFor={l.id} className="flex-1">{l.name}</label>
                </div>
                {!l.available && <p className="ml-5 text-xs text-muted">{l.unavailable_reason}</p>}
                {l.available && l.warning && <p className="ml-5 text-xs text-amber">{l.warning}</p>}
                {l.available && l.id !== "rainfall_daily_point" && <p className="ml-5 text-xs text-muted">{l.kind === "derived" ? "Calculated per district in the Risk and Crops pages." : "Shown in the district panel."}</p>}
                {l.id === "rainfall_daily_point" && rainOn && (
                  <div className="ml-5 mt-2 space-y-2">
                    {rainLoading && <p className="text-xs text-muted">Loading 30 days for 25 districts from NASA POWER…</p>}
                    <Label htmlFor="op">Opacity</Label><input id="op" type="range" min={0.1} max={1} step={0.05} value={rainOpacity} onChange={(e) => setRainOpacity(+e.target.value)} className="w-full accent-cyan" />
                    <div className="flex items-center gap-2 text-xs"><span className="h-3 w-3 rounded-full bg-slate" />0 mm<span className="ml-2 h-3 w-3 rounded-full bg-cyan" />5 mm<span className="ml-2 h-4 w-4 rounded-full bg-blue-600" />30+ mm</div>
                  </div>)}
              </li>))}
          </ul>
          {rainOn && <ProvenanceNote p={layers.data?.items.find((l) => l.id === "rainfall_daily_point")?.provenance} />}
        </aside>
      )}

      {/* time-series playback */}
      {rainOn && rain && (
        <div className="glass absolute bottom-6 left-1/2 z-10 flex w-[min(560px,90%)] -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm">
          <button aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)} className="rounded-full bg-emerald p-1.5 text-abyss">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
          <input aria-label="Observation date" type="range" min={0} max={rain.dates.length - 1} value={day} onChange={(e) => { setPlaying(false); setDay(+e.target.value); }} className="flex-1 accent-cyan" />
          <span className="tabular w-24 text-right">{rain.dates[day]}</span><DataTag kind="historical" />
        </div>
      )}

      {/* district intelligence panel */}
      {selected && !drawing && (
        <aside className="glass absolute bottom-6 left-3 z-10 w-80 rounded-2xl p-4 text-sm" aria-live="polite">
          <div className="flex items-start justify-between"><div><p className="font-display text-xl font-semibold">{selected}</p><p className="text-xs text-muted">{snap.data?.district.province} Province, district centroid</p></div>
            <button aria-label="Close panel" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button></div>
          {snap.isLoading && <div className="skeleton mt-3 h-24" />}
          {snap.isError && <div className="mt-3"><ErrorState error={snap.error} /></div>}
          {snap.data && (<>
            <dl className="mt-3 grid grid-cols-2 gap-y-1.5">
              <dt className="text-muted">Rain, last 30 days</dt><dd className="tabular text-right">{snap.data.climate ? `${fmt(snap.data.climate.rain_30d_mm)} mm` : "Unavailable"}</dd>
              <dt className="text-muted">Mean temperature</dt><dd className="tabular text-right">{snap.data.climate?.mean_temp_c != null ? `${fmt(snap.data.climate.mean_temp_c, 1)} °C` : "Unavailable"}</dd>
              <dt className="text-muted">Root-zone wetness</dt><dd className="tabular text-right">{snap.data.soil?.root_zone_latest != null ? fmt(snap.data.soil.root_zone_latest, 2) : "Unavailable"}</dd>
              <dt className="text-muted">Vegetation (NDVI)</dt><dd className="text-right text-muted">Not configured</dd>
            </dl>
            {snap.data.climate && <p className="mt-2 text-xs text-muted">{snap.data.climate.start} to {snap.data.climate.end}</p>}
            <div className="mt-3 flex gap-3 text-xs"><a className="text-cyan" href={`/app/crops?district=${encodeURIComponent(selected)}`}>Recommended crops</a><a className="text-cyan" href={`/app/risk?district=${encodeURIComponent(selected)}`}>Agricultural risk</a></div>
            <ProvenanceNote p={snap.data.provenance.slice(0, 1)} />
          </>)}
        </aside>
      )}
    </div>
  );
}
