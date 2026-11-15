// Builds public/geo/lk-admin.topo.json (9 provinces + 25 districts) from lk_admin_regions GeoJSON.
// Source: github.com/nuuuwan/lk_admin_regions (MIT), derived from Dept. of Census & Statistics and HDX boundaries.
// Usage: node scripts/build-lk-admin.mjs <provinces.geojson> <districts.geojson>
import fs from "node:fs";
import { topology } from "topojson-server";
import { presimplify, simplify, quantile } from "topojson-simplify";
import { feature } from "topojson-client";
const [provPath, distPath] = process.argv.slice(2);
// d3-geo expects exterior rings clockwise (holes counter-clockwise); the source uses the RFC 7946 opposite.
const area = (ring) => ring.reduce((a, [x1, y1], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return a + (x2 - x1) * (y2 + y1); }, 0);
const orient = (ring, clockwise) => ((area(ring) > 0) === clockwise ? ring : [...ring].reverse());
const rewindPoly = (poly) => poly.map((ring, i) => orient(ring, i === 0));
const rewind = (g) => g.type === "Polygon" ? { ...g, coordinates: rewindPoly(g.coordinates) }
  : g.type === "MultiPolygon" ? { ...g, coordinates: g.coordinates.map(rewindPoly) } : g;
const clean = (fc, keep) => ({
  type: "FeatureCollection",
  features: fc.features.map((f) => ({ type: "Feature", id: f.properties.id, geometry: rewind(f.geometry),
    properties: Object.fromEntries(keep.map((k) => [k, f.properties[k]])) })),
});
const provinces = clean(JSON.parse(fs.readFileSync(provPath)), ["id", "name", "area_sqkm", "other_names"]);
const districts = clean(JSON.parse(fs.readFileSync(distPath)), ["id", "name", "area_sqkm", "other_names", "province_id"]);
// 1) simplify on a shared topology so province and district borders stay aligned
let topo = presimplify(topology({ provinces, districts }));
topo = simplify(topo, quantile(topo, 0.9));
// 2) drop simplification weights, round to ~10 m, rebuild a compact quantized topology
const round = (c) => (typeof c[0] === "number" ? [+c[0].toFixed(4), +c[1].toFixed(4)] : c.map(round));
const strip = (fc) => ({ ...fc, features: fc.features.map((f) => ({ ...f, geometry: rewind({ ...f.geometry, coordinates: round(f.geometry.coordinates) }) })) });
const out = topology({ provinces: strip(feature(topo, topo.objects.provinces)), districts: strip(feature(topo, topo.objects.districts)) }, 1e4);
fs.writeFileSync("public/geo/lk-admin.topo.json", JSON.stringify(out));
console.log("provinces", provinces.features.length, "districts", districts.features.length, "bytes", fs.statSync("public/geo/lk-admin.topo.json").size);
