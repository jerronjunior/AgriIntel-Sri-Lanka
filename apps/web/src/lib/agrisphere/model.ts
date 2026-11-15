/**
 * AgriSphere district intelligence model.
 *
 * Every value is wrapped in `S<T>` with its source:
 *   live   – loaded from the AgriIntel API (NASA POWER-backed)                → tagged "Historical"
 *   demo   – illustrative values generated here until a real source is wired → tagged "Demo"
 *   mixed  – partly live, partly demo (e.g. live suitability, demo prices)     → tagged "Partly demo"
 *   none   – no source and no demo value                                     → shown as unavailable
 *
 * Demo values are deterministic per district/season and loosely follow Sri Lanka's agro-climatic zones
 * so the layout reads realistically, but they are NOT data and must never be presented as such.
 */

export type Source = "live" | "mixed" | "demo" | "none";
export type S<T> = { v: T; src: Source; note?: string };
export type Season = "maha" | "yala";
export type Level5 = "Very low" | "Low" | "Moderate" | "High" | "Critical";
export type Level3 = "Low" | "Medium" | "High";
export type Zone = "Dry" | "Intermediate" | "Wet" | "Hill country";

export const CROPS = [
  { key: "paddy", name: "Paddy" }, { key: "maize", name: "Maize" }, { key: "green_gram", name: "Green gram" },
  { key: "groundnut", name: "Groundnut" }, { key: "sesame", name: "Sesame" }, { key: "chili", name: "Chili" },
  { key: "onion", name: "Big onion" }, { key: "cowpea", name: "Cowpea" },
] as const;
export type CropKey = (typeof CROPS)[number]["key"];
export const cropName = (k: string) => CROPS.find((c) => c.key === k)?.name ?? k.replaceAll("_", " ");

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const SEASON_INFO: Record<Season, { name: string; sowing: string; months: number[]; harvestMonth: number }> = {
  maha: { name: "Maha", sowing: "October – November", months: [10, 11, 12, 1, 2], harvestMonth: 2 },
  yala: { name: "Yala", sowing: "April – May", months: [4, 5, 6, 7, 8], harvestMonth: 8 },
};

// Generalised agro-climatic zone and major soil group per district (indicative, for demo shaping only).
const DISTRICT_PROFILE: Record<string, { zone: Zone; soil: string }> = {
  "LK-11": { zone: "Wet", soil: "Red-Yellow Podzolic" }, "LK-12": { zone: "Wet", soil: "Red-Yellow Podzolic" },
  "LK-13": { zone: "Wet", soil: "Red-Yellow Podzolic" }, "LK-21": { zone: "Hill country", soil: "Red-Yellow Podzolic" },
  "LK-22": { zone: "Intermediate", soil: "Reddish Brown Earth" }, "LK-23": { zone: "Hill country", soil: "Red-Yellow Podzolic" },
  "LK-31": { zone: "Wet", soil: "Red-Yellow Podzolic" }, "LK-32": { zone: "Wet", soil: "Red-Yellow Podzolic" },
  "LK-33": { zone: "Dry", soil: "Reddish Brown Earth" }, "LK-41": { zone: "Dry", soil: "Red-Yellow Latosol" },
  "LK-42": { zone: "Dry", soil: "Reddish Brown Earth" }, "LK-43": { zone: "Dry", soil: "Reddish Brown Earth" },
  "LK-44": { zone: "Dry", soil: "Reddish Brown Earth" }, "LK-45": { zone: "Dry", soil: "Reddish Brown Earth" },
  "LK-51": { zone: "Dry", soil: "Non-Calcic Brown" }, "LK-52": { zone: "Dry", soil: "Reddish Brown Earth" },
  "LK-53": { zone: "Dry", soil: "Reddish Brown Earth" }, "LK-61": { zone: "Intermediate", soil: "Reddish Brown Earth" },
  "LK-62": { zone: "Dry", soil: "Reddish Brown Earth" }, "LK-71": { zone: "Dry", soil: "Reddish Brown Earth" },
  "LK-72": { zone: "Dry", soil: "Reddish Brown Earth" }, "LK-81": { zone: "Hill country", soil: "Red-Yellow Podzolic" },
  "LK-82": { zone: "Dry", soil: "Reddish Brown Earth" }, "LK-91": { zone: "Wet", soil: "Red-Yellow Podzolic" },
  "LK-92": { zone: "Wet", soil: "Red-Yellow Podzolic" },
};
// Northern-province codes differ between datasets; fall back by name if needed.
const NAME_TO_ID: Record<string, string> = { Kilinochchi: "LK-45", Mannar: "LK-42", Vavuniya: "LK-43", Mullaitivu: "LK-44", Jaffna: "LK-41" };

// Demo base suitability by zone and season (0–100).
const BASE: Record<Zone, Record<Season, Record<CropKey, number>>> = {
  Dry: {
    yala: { paddy: 48, maize: 66, green_gram: 84, groundnut: 88, sesame: 86, chili: 62, onion: 58, cowpea: 85 },
    maha: { paddy: 86, maize: 82, green_gram: 70, groundnut: 74, sesame: 60, chili: 76, onion: 66, cowpea: 72 },
  },
  Intermediate: {
    yala: { paddy: 60, maize: 72, green_gram: 76, groundnut: 78, sesame: 74, chili: 70, onion: 72, cowpea: 76 },
    maha: { paddy: 84, maize: 80, green_gram: 68, groundnut: 70, sesame: 58, chili: 78, onion: 70, cowpea: 70 },
  },
  Wet: {
    yala: { paddy: 82, maize: 52, green_gram: 40, groundnut: 44, sesame: 34, chili: 50, onion: 30, cowpea: 46 },
    maha: { paddy: 80, maize: 50, green_gram: 38, groundnut: 42, sesame: 30, chili: 48, onion: 28, cowpea: 44 },
  },
  "Hill country": {
    yala: { paddy: 62, maize: 64, green_gram: 42, groundnut: 46, sesame: 36, chili: 58, onion: 60, cowpea: 48 },
    maha: { paddy: 66, maize: 66, green_gram: 40, groundnut: 44, sesame: 34, chili: 60, onion: 64, cowpea: 46 },
  },
};
// Demo per-hectare economics (LKR) and yields (t/ha) — illustrative only.
const ECON: Record<CropKey, { yieldT: number; priceKg: number; costHa: number; waterMm: number; exportable: boolean }> = {
  paddy: { yieldT: 4.4, priceKg: 120, costHa: 280000, waterMm: 1150, exportable: false },
  maize: { yieldT: 5.0, priceKg: 90, costHa: 260000, waterMm: 600, exportable: false },
  green_gram: { yieldT: 0.9, priceKg: 560, costHa: 240000, waterMm: 320, exportable: true },
  groundnut: { yieldT: 1.8, priceKg: 380, costHa: 340000, waterMm: 540, exportable: true },
  sesame: { yieldT: 0.8, priceKg: 520, costHa: 210000, waterMm: 380, exportable: true },
  chili: { yieldT: 2.0, priceKg: 800, costHa: 900000, waterMm: 520, exportable: false },
  onion: { yieldT: 15, priceKg: 130, costHa: 1400000, waterMm: 450, exportable: false },
  cowpea: { yieldT: 1.0, priceKg: 420, costHa: 210000, waterMm: 280, exportable: true },
};

// ---------------------------------------------------------------- deterministic pseudo-random
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: string) {
  let x = hash(seed) || 1;
  return () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)), ((x ^= x >>> 16) >>> 0) / 4294967296);
}
const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const level5 = (v: number): Level5 => (v < 20 ? "Very low" : v < 40 ? "Low" : v < 60 ? "Moderate" : v < 80 ? "High" : "Critical");
const level3 = (v: number): Level3 => (v < 34 ? "Low" : v < 67 ? "Medium" : "High");
const demo = <T,>(v: T, note?: string): S<T> => ({ v, src: "demo", note });

// ---------------------------------------------------------------- types
export type CropIntel = {
  crop: CropKey; suitability: number; yieldBest: number; yieldExpected: number; yieldWorst: number;
  revenueHa: number; costHa: number; profitHa: number; roi: number; waterMm: number;
  market: number; climate: number; yieldScore: number; profitability: number; opportunity: number;
};
export type DistrictIntel = {
  id: string; name: string; provinceId: string; season: Season; zone: Zone; soilType: string;
  climate: { stability: S<number>; rainfallDeviation: S<number>; heatStress: S<Level3>; waterSecurity: S<Level3>;
    droughtByMonth: S<Level5[]>; floodNext7: S<Level3>; meanTempC: S<number | null>; seasonRainMm: S<number | null> };
  water: { index: S<number>; reservoir: S<number>; groundwater: S<number>; rainfallPotential: S<number>; soilRetention: S<number>;
    rootZoneWetness: S<number | null> };
  soil: { drainage: S<Level3>; compaction: S<Level3>; erosion: S<Level3>; waterHolding: S<Level3> };
  crops: S<CropIntel[]>; avoid: S<CropKey[]>;
  market: { demand: S<Level5>; saturation: S<{ crop: CropKey; risk: Level3; reason: string }>; priceTrend: S<"Rising" | "Stable" | "Falling"> };
  export: S<{ crop: CropKey; productionT: number; quality: "A" | "B" | "C"; harvest: string; opportunity: Level3 }[]>;
  insurance: { flood: S<number>; drought: S<number>; yieldVolatility: S<number>; overall: S<number> };
  lending: { location: S<number>; crop: S<number>; climate: S<number>; market: S<number>; yield: S<number>; overall: S<number> };
};

export const OPP_WEIGHTS = { suitability: 0.3, yield: 0.15, market: 0.2, climate: 0.15, profitability: 0.2 };

// ---------------------------------------------------------------- demo generator
export function profileFor(id: string, name: string) {
  return DISTRICT_PROFILE[id] ?? DISTRICT_PROFILE[NAME_TO_ID[name] ?? ""] ?? { zone: "Intermediate" as Zone, soil: "Reddish Brown Earth" };
}

export function demoDistrict(id: string, name: string, provinceId: string, season: Season): DistrictIntel {
  const r = rng(`${id}:${season}`);
  const { zone, soil } = profileFor(id, name);
  const urban = id === "LK-11" || id === "LK-12" ? 18 : 0; // Colombo and Gampaha: little farmland, so lower agricultural opportunity
  const dry = zone === "Dry", wet = zone === "Wet";
  const jitter = (n: number) => (r() - 0.5) * 2 * n;

  const rainDev = Math.round(jitter(25) - (dry && season === "yala" ? 8 : 0));
  const stability = Math.round(clamp(72 - Math.abs(rainDev) * 0.6 + jitter(8) - (dry ? 6 : 0)));
  const heat = level3(clamp((dry ? 70 : zone === "Hill country" ? 10 : 40) + jitter(20)));
  const reservoir = Math.round(clamp((dry ? 62 : 40) + jitter(20)));
  const groundwater = Math.round(clamp((wet ? 70 : 45) + jitter(18)));
  const rainPot = Math.round(clamp((wet ? 82 : season === "maha" ? 64 : 38) + jitter(12)));
  const retention = Math.round(clamp((soil === "Reddish Brown Earth" ? 58 : soil === "Non-Calcic Brown" ? 40 : 66) + jitter(10)));
  const waterIndex = Math.round(0.3 * reservoir + 0.2 * groundwater + 0.3 * rainPot + 0.2 * retention);
  const droughtByMonth = MONTHS.map((_, m) => {
    const dryMonth = [1, 2, 6, 7, 8].includes(m) ? 25 : 0;
    return level5(clamp((dry ? 35 : wet ? 5 : 20) + dryMonth + jitter(15)));
  });

  const crops: CropIntel[] = CROPS.map(({ key }) => {
    const e = ECON[key];
    const suit = Math.round(clamp(BASE[zone][season][key] + jitter(6) - urban));
    const yf = 0.55 + (suit / 100) * 0.5;
    const yExp = +(e.yieldT * yf).toFixed(2);
    const priceAdj = 1 + jitter(0.12);
    const revenue = Math.round(yExp * 1000 * e.priceKg * priceAdj);
    const profit = revenue - e.costHa;
    const roi = Math.round((profit / e.costHa) * 100);
    const market = Math.round(clamp(55 + jitter(30) + (e.exportable ? 6 : 0) - (key === "chili" ? 12 : 0)));
    const climate = Math.round(clamp(stability * 0.6 + suit * 0.4 + jitter(5)));
    const yieldScore = Math.round(clamp(yf * 90 + jitter(5)));
    const profitability = Math.round(clamp(50 + roi / 3));
    const opportunity = Math.round(OPP_WEIGHTS.suitability * suit + OPP_WEIGHTS.yield * yieldScore + OPP_WEIGHTS.market * market +
      OPP_WEIGHTS.climate * climate + OPP_WEIGHTS.profitability * profitability);
    return { crop: key, suitability: suit, yieldBest: +(yExp * 1.18).toFixed(2), yieldExpected: yExp, yieldWorst: +(yExp * 0.78).toFixed(2),
      revenueHa: revenue, costHa: e.costHa, profitHa: profit, roi, waterMm: e.waterMm, market, climate, yieldScore, profitability, opportunity };
  }).sort((a, b) => b.opportunity - a.opportunity);

  const avoid = crops.filter((c) => c.suitability < 45).map((c) => c.crop);
  // saturation only matters for crops that are actually suited to (and so widely planted in) the district
  const sat = crops.filter((c) => c.suitability >= 55).sort((a, b) => a.market - b.market)[0] ?? crops[0];
  const ins = { flood: Math.round(clamp((wet ? 62 : dry ? 30 : 42) + jitter(15))), drought: Math.round(clamp((dry ? 66 : wet ? 18 : 40) + jitter(14))),
    vol: Math.round(clamp(30 + Math.abs(rainDev) + jitter(10))) };
  const insOverall = Math.round(0.35 * ins.flood + 0.4 * ins.drought + 0.25 * ins.vol);
  const top = crops[0];
  const lend = { location: Math.round(clamp(100 - stability + jitter(8))), crop: 100 - top.suitability, climate: Math.round(clamp(insOverall + jitter(6))),
    market: 100 - top.market, yield: ins.vol };
  const lendOverall = Math.round(0.2 * lend.location + 0.2 * lend.crop + 0.25 * lend.climate + 0.15 * lend.market + 0.2 * lend.yield);
  const harvest = MONTHS[SEASON_INFO[season].harvestMonth - 1];

  return {
    id, name, provinceId, season, zone, soilType: soil,
    climate: { stability: demo(stability), rainfallDeviation: demo(rainDev), heatStress: demo(heat), waterSecurity: demo(level3(waterIndex)),
      droughtByMonth: demo(droughtByMonth), floodNext7: demo(level3(ins.flood + jitter(15))), meanTempC: { v: null, src: "none" }, seasonRainMm: { v: null, src: "none" } },
    water: { index: demo(waterIndex), reservoir: demo(reservoir), groundwater: demo(groundwater), rainfallPotential: demo(rainPot), soilRetention: demo(retention),
      rootZoneWetness: { v: null, src: "none" } },
    soil: { drainage: demo(level3(soil === "Red-Yellow Podzolic" ? 75 : 50 + jitter(20))), compaction: demo(level3(40 + jitter(30))),
      erosion: demo(level3(zone === "Hill country" ? 80 : 35 + jitter(25))), waterHolding: demo(level3(retention)) },
    crops: demo(crops), avoid: demo(avoid),
    market: { demand: demo(level5(top.market)), saturation: demo({ crop: sat.crop, risk: level3(100 - sat.market),
      reason: `Many districts are expected to plant ${cropName(sat.crop).toLowerCase()} this ${SEASON_INFO[season].name} season.` }),
      priceTrend: demo(r() > 0.6 ? "Rising" : r() > 0.3 ? "Stable" : "Falling") },
    export: demo(crops.filter((c) => ECON[c.crop].exportable).slice(0, 3).map((c) => ({
      crop: c.crop, productionT: Math.round(c.yieldExpected * (800 + r() * 4000)), quality: c.suitability > 75 ? "A" as const : c.suitability > 55 ? "B" as const : "C" as const,
      harvest: `${harvest} ${new Date().getFullYear() + (season === "maha" && new Date().getMonth() > 1 ? 1 : 0)}`, opportunity: level3(c.market) }))),
    insurance: { flood: demo(ins.flood), drought: demo(ins.drought), yieldVolatility: demo(ins.vol), overall: demo(insOverall) },
    lending: { location: demo(lend.location), crop: demo(lend.crop), climate: demo(lend.climate), market: demo(lend.market), yield: demo(lend.yield), overall: demo(lendOverall) },
  };
}

// ---------------------------------------------------------------- derived outputs
export function opportunityOf(c: Omit<CropIntel, "opportunity">) {
  return Math.round(OPP_WEIGHTS.suitability * c.suitability + OPP_WEIGHTS.yield * c.yieldScore + OPP_WEIGHTS.market * c.market +
    OPP_WEIGHTS.climate * c.climate + OPP_WEIGHTS.profitability * c.profitability);
}

export function lendingBand(score: number) {
  // Decision support only — never an automated approve/reject.
  if (score < 35) return { label: "Favourable", tone: "emerald", hint: "Risk indicators support standard terms." };
  if (score < 60) return { label: "Review conditions", tone: "amber", hint: "Consider irrigation, insurance or crop-mix conditions." };
  return { label: "Elevated risk", tone: "rose", hint: "Requires full credit-committee review and mitigation." };
}

export function allocate(crops: CropIntel[], hectares: number, n = 4) {
  const pick = crops.filter((c) => c.suitability >= 55).slice(0, n);
  const list = pick.length ? pick : crops.slice(0, n);
  // weight by how far each crop stands above the weakest candidate, so close scores still differentiate
  const floor = Math.min(...list.map((c) => c.opportunity)) - 10;
  const w = (c: CropIntel) => (c.opportunity - floor) ** 2;
  const total = list.reduce((a, c) => a + w(c), 0);
  let left = 100;
  return list.map((c, i) => {
    const pct = i === list.length - 1 ? left : Math.round((w(c) / total) * 100 / 5) * 5;
    left -= pct;
    return { crop: c.crop, pct, ha: +((hectares * pct) / 100).toFixed(1) };
  }).filter((x) => x.pct > 0);
}

export type Metric = "opportunity" | "stability" | "water" | "insurance";
export const METRICS: Record<Metric, { label: string; good: boolean; get: (d: DistrictIntel) => number }> = {
  opportunity: { label: "Opportunity score", good: true, get: (d) => d.crops.v[0].opportunity },
  stability: { label: "Climate stability", good: true, get: (d) => d.climate.stability.v },
  water: { label: "Water availability", good: true, get: (d) => d.water.index.v },
  insurance: { label: "Insurance risk", good: false, get: (d) => d.insurance.overall.v },
};
