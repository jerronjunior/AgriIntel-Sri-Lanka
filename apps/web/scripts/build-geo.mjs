// Precompute globe land dots and the Sri Lanka outline from Natural Earth (world-atlas, public domain).
import fs from "node:fs";
import { feature } from "topojson-client";
import { geoContains } from "d3-geo";
const land = JSON.parse(fs.readFileSync("node_modules/world-atlas/land-110m.json"));
const countries = JSON.parse(fs.readFileSync("node_modules/world-atlas/countries-10m.json"));
const landGeo = feature(land, land.objects.land);
const dots = [];
const step = 1.6;
for (let lat = -84; lat <= 84; lat += step) {
  const circ = Math.cos((lat * Math.PI) / 180);
  const n = Math.max(1, Math.round((360 / step) * circ));
  for (let i = 0; i < n; i++) {
    const lon = -180 + (360 * i) / n;
    if (geoContains(landGeo, [lon, lat])) dots.push([+lon.toFixed(2), +lat.toFixed(2)]);
  }
}
const lk = feature(countries, countries.objects.countries).features.find((f) => f.id === "144");
if (!lk) throw new Error("Sri Lanka not found");
fs.writeFileSync("public/geo/globe-dots.json", JSON.stringify(dots));
fs.writeFileSync("public/geo/sri-lanka.json", JSON.stringify({ type: "Feature", properties: { name: "Sri Lanka", source: "Natural Earth 1:10m via world-atlas" }, geometry: lk.geometry }));
console.log("dots", dots.length, "lk coords", JSON.stringify(lk.geometry).length);
