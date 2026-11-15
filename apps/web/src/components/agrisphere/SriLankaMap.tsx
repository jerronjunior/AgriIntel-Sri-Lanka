"use client";
import { geoMercator, geoPath } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export type AdminProps = { id: string; name: string; area_sqkm: number; other_names: string; province_id?: string };
export type AdminFC = FeatureCollection<Geometry, AdminProps>;

const W = 560, H = 900;
const GOOD = ["#0d2c40", "#0e4a5a", "#0f6e6a", "#0f9475", "#22b98a"];
const RISK = ["#16263a", "#4d3b16", "#9a5b0b", "#d9480f", "#e11d48"];

/** Quantile colouring: values are ranked within the areas on screen, so small differences stay visible. */
export function colorScale(vals: number[], good: boolean) {
  const sorted = [...vals].sort((a, b) => a - b);
  const pal = good ? GOOD : RISK;
  return (v: number | undefined) => {
    if (v === undefined || Number.isNaN(v)) return "var(--panel-2)";
    if (sorted.length < 2 || sorted[0] === sorted[sorted.length - 1]) return pal[2];
    const lo = sorted.findIndex((x) => x >= v), hi = sorted.length - 1 - [...sorted].reverse().findIndex((x) => x <= v);
    const rank = (lo + hi) / 2 / (sorted.length - 1);
    return pal[Math.min(4, Math.floor(rank * 5))];
  };
}

type Shape = { id: string; name: string; d: string; bounds: [[number, number], [number, number]]; c: [number, number]; parent?: string };

export default function SriLankaMap({
  provinces, districts, values, good, provinceId, districtId, onProvince, onDistrict, metricLabel,
}: {
  provinces: AdminFC; districts: AdminFC; values: Record<string, number>; good: boolean; metricLabel: string;
  provinceId: string | null; districtId: string | null; onProvince: (id: string | null) => void; onDistrict: (id: string) => void;
}) {
  const { pShapes, dShapes } = useMemo(() => {
    const proj = geoMercator().fitExtent([[12, 12], [W - 12, H - 12]], provinces);
    const path = geoPath(proj);
    const mk = (f: Feature<Geometry, AdminProps>): Shape => ({
      id: f.properties.id, name: f.properties.name, d: path(f) ?? "", bounds: path.bounds(f) as Shape["bounds"],
      c: path.centroid(f) as [number, number], parent: f.properties.province_id,
    });
    return { pShapes: provinces.features.map(mk), dShapes: districts.features.map(mk) };
  }, [provinces, districts]);

  // ---- animated viewBox (zoom to the selected province)
  const target = useMemo<[number, number, number, number]>(() => {
    const p = pShapes.find((s) => s.id === provinceId);
    if (!p) return [0, 0, W, H];
    const [[x0, y0], [x1, y1]] = p.bounds;
    const pad = 0.12;
    let w = (x1 - x0) * (1 + pad * 2), h = (y1 - y0) * (1 + pad * 2);
    if (w / h > W / H) h = (w * H) / W; else w = (h * W) / H;
    return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
  }, [provinceId, pShapes]);
  const [vb, setVb] = useState<[number, number, number, number]>([0, 0, W, H]);
  const vbRef = useRef(vb);
  useEffect(() => {
    const from = vbRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { vbRef.current = target; setVb(target); return; }
    const t0 = performance.now(), dur = 700;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const next = from.map((f, i) => f + (target[i] - f) * e) as typeof vb;
      vbRef.current = next;
      setVb(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const k = W / vb[2]; // zoom factor, used to keep labels and strokes a constant on-screen size

  const shown = provinceId ? dShapes.filter((s) => s.parent === provinceId) : pShapes;
  const nums = shown.map((s) => values[s.id]).filter((v) => v !== undefined);
  const min = Math.min(...nums), max = Math.max(...nums);
  const color = colorScale(nums, good);

  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; name: string; v?: number } | null>(null);
  useEffect(() => setTip(null), [provinceId, districtId]);
  const hover = (e: React.MouseEvent, s: Shape) => {
    const r = wrap.current!.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, name: s.name, v: values[s.id] });
  };
  const keyAct = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

  return (
    <div ref={wrap} className="relative h-full w-full" onMouseLeave={() => setTip(null)}>
      <svg viewBox={vb.join(" ")} className="h-full w-full" role="group" aria-label={provinceId ? "Districts of the selected province" : "Provinces of Sri Lanka"}>
        <defs>
          <filter id="as-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={3 / k} result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect x={vb[0] - 50} y={vb[1] - 50} width={vb[2] + 100} height={vb[3] + 100} fill="transparent" onClick={() => provinceId && onProvince(null)} />

        {/* provinces: choropleth at national level; muted context (still clickable) at province level */}
        {pShapes.map((s) => {
          const active = s.id === provinceId;
          return (
            <path key={s.id} d={s.d} role="button" tabIndex={provinceId && active ? -1 : 0}
              aria-label={`${s.name} Province${values[s.id] !== undefined && !provinceId ? `, ${metricLabel} ${values[s.id]}` : ""}`}
              fill={provinceId ? (active ? "var(--panel)" : "var(--panel-2)") : color(values[s.id])}
              fillOpacity={provinceId && !active ? 0.55 : 1}
              stroke={active ? "#10B981" : "var(--bg)"} strokeWidth={(active ? 2.2 : 1.2) / k} strokeLinejoin="round"
              className="cursor-pointer outline-none transition-[fill-opacity] hover:fill-opacity-80 focus-visible:stroke-cyan"
              onClick={(e) => { e.stopPropagation(); if (!active) onProvince(s.id); }}
              onKeyDown={keyAct(() => !active && onProvince(s.id))}
              onMouseMove={(e) => !provinceId && hover(e, s)} />
          );
        })}

        {/* districts of the selected province */}
        {provinceId && dShapes.filter((s) => s.parent === provinceId).map((s) => {
          const sel = s.id === districtId;
          return (
            <path key={s.id} d={s.d} role="button" tabIndex={0} aria-pressed={sel}
              aria-label={`${s.name} District, ${metricLabel} ${values[s.id] ?? "no data"}`}
              fill={color(values[s.id])} fillOpacity={districtId && !sel ? 0.7 : 1}
              stroke="var(--bg)" strokeWidth={1 / k} strokeLinejoin="round"
              filter={sel ? "url(#as-glow)" : undefined}
              className="cursor-pointer outline-none hover:fill-opacity-90 focus-visible:stroke-cyan"
              onClick={(e) => { e.stopPropagation(); onDistrict(s.id); }} onKeyDown={keyAct(() => onDistrict(s.id))}
              onMouseMove={(e) => hover(e, s)} />
          );
        })}
        {/* selected district outline drawn last so it sits above its neighbours */}
        {districtId && (() => { const s = dShapes.find((x) => x.id === districtId); return s ? <path d={s.d} fill="none" stroke="var(--text)" strokeWidth={2.5 / k} strokeLinejoin="round" pointerEvents="none" filter="url(#as-glow)" /> : null; })()}

        {/* labels */}
        <g pointerEvents="none" fontFamily="var(--font-sans)" fontWeight={600} textAnchor="middle" style={{ paintOrder: "stroke" }}
          stroke="var(--bg)" strokeWidth={3 / k} strokeLinejoin="round" fill="var(--text)">
          {(provinceId ? dShapes.filter((s) => s.parent === provinceId) : pShapes).map((s) => (
            <text key={s.id} x={s.c[0]} y={s.c[1]} fontSize={(provinceId ? 12 : 12.5) / k} dy="0.35em">{s.name}</text>
          ))}
        </g>
      </svg>

      {tip && (
        <div className="glass pointer-events-none absolute z-10 rounded-lg px-3 py-2 text-xs" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <p className="font-semibold">{tip.name}</p><p className="text-muted">{metricLabel}: <span className="tabular text-ink">{tip.v ?? "—"}</span></p>
        </div>
      )}

      <div className="glass absolute bottom-2 left-2 rounded-xl p-2 text-xs sm:bottom-3 sm:left-3 sm:p-3">
        <p className="mb-1.5 font-medium">{metricLabel}</p>
        <div className="flex">{(good ? GOOD : RISK).map((c) => <span key={c} className="h-2 w-5 first:rounded-l last:rounded-r sm:h-2.5 sm:w-8" style={{ background: c }} />)}</div>
        <div className="mt-1 flex justify-between tabular text-muted"><span>{Number.isFinite(min) ? min : "—"}</span><span>{Number.isFinite(max) ? max : "—"}</span></div>
        <p className="mt-1 hidden text-[11px] text-muted sm:block">Shaded by rank among the areas shown</p>
      </div>
    </div>
  );
}
