"use client";
import dynamic from "next/dynamic";
import { geoOrthographic, geoPath } from "d3-geo";
import { useEffect, useMemo, useState } from "react";

const GlobeScene = dynamic(() => import("./GlobeScene"), { ssr: false });

function canUse3D() {
  if (typeof window === "undefined") return false;
  const force = new URLSearchParams(window.location.search).get("globe");
  if (force) return force === "3d";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.innerWidth < 768) return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

/** Static orthographic fallback: same Natural Earth dots, centred on Sri Lanka, no WebGL. */
function StaticGlobe() {
  const [dots, setDots] = useState<[number, number][]>([]);
  useEffect(() => { fetch("/geo/globe-dots.json").then((r) => r.json()).then(setDots).catch(() => {}); }, []);
  const proj = useMemo(() => geoOrthographic().rotate([-78, -6]).scale(190).translate([200, 200]).clipAngle(90), []);
  const outline = geoPath(proj)({ type: "Sphere" }) ?? "";
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label="Globe centred on Sri Lanka">
      <defs><radialGradient id="atm" r="0.6"><stop offset="0.8" stopColor="#22D3EE" stopOpacity="0" /><stop offset="1" stopColor="#22D3EE" stopOpacity="0.25" /></radialGradient></defs>
      <circle cx="200" cy="200" r="215" fill="url(#atm)" />
      <path d={outline} fill="#061421" stroke="#22D3EE" strokeOpacity="0.25" />
      {dots.map(([lon, lat], i) => {
        const p = proj([lon, lat]);
        const vis = geoPath(proj)({ type: "Point", coordinates: [lon, lat] });
        if (!p || !vis) return null;
        const lk = lat > 5.5 && lat < 10.2 && lon > 79.3 && lon < 82.2;
        return <circle key={i} cx={p[0]} cy={p[1]} r={lk ? 2.6 : 1.1} fill={lk ? "#10B981" : "#5b8fa8"} />;
      })}
    </svg>
  );
}

export default function Globe({ progress }: { progress: React.RefObject<number> }) {
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  useEffect(() => setMode(canUse3D() ? "3d" : "static"), []);
  if (mode === "pending") return null;
  return mode === "3d" ? <GlobeScene progress={progress} /> : <StaticGlobe />;
}
