/**
 * AgriSphere Copilot — rules-based answers composed from the same district data shown on the page.
 * No LLM yet: every statement is traceable to a value in DistrictIntel. Swap `answer()` for a call to a
 * server-side LLM endpoint later, passing the same data as grounding context.
 */
import { allocate, cropName, lendingBand, MONTHS, SEASON_INFO, type DistrictIntel, type Season, type Source } from "./model";

export type CopilotAnswer = { title: string; ranked?: string[]; reasons: string[]; facts: [string, string][]; sources: Source[]; followUps: string[] };

const has = (q: string, ...w: string[]) => w.some((x) => q.includes(x));
const lvl = (n: number) => (n < 35 ? "Low" : n < 60 ? "Moderate" : "High");

export function findDistrict(q: string, names: string[]) {
  const l = q.toLowerCase();
  return names.find((n) => l.includes(n.toLowerCase())) ?? names.find((n) => l.includes(n.toLowerCase().slice(0, 6)));
}

export function parseSeason(q: string): Season | null {
  const l = q.toLowerCase();
  return l.includes("yala") ? "yala" : l.includes("maha") ? "maha" : null;
}

export function answer(q: string, d: DistrictIntel, national: DistrictIntel[]): CopilotAnswer {
  const l = q.toLowerCase();
  const s = SEASON_INFO[d.season].name;
  const crops = d.crops.v;
  const top = crops[0];
  const src = (...x: Source[]) => [...new Set(x)];
  const ha = Number(l.match(/(\d+(?:\.\d+)?)\s*(ha|hectare)/)?.[1] ?? 0);

  if (has(l, "water", "irrigat", "rain")) {
    return {
      title: `Water outlook for ${d.name}, ${s}`,
      reasons: [
        `Water availability index ${d.water.index.v}/100 (${lvl(d.water.index.v)}).`,
        d.climate.rainfallDeviation.v < 0 ? `Rainfall is running ${Math.abs(d.climate.rainfallDeviation.v)}% below normal.` : `Rainfall is ${d.climate.rainfallDeviation.v}% above normal.`,
        `Lowest-water options: ${crops.slice().sort((a, b) => a.waterMm - b.waterMm).slice(0, 3).map((c) => `${cropName(c.crop)} (${c.waterMm} mm)`).join(", ")}.`,
      ],
      facts: [["Season rainfall normal", d.climate.seasonRainMm.v != null ? `${d.climate.seasonRainMm.v} mm` : "—"], ["Root-zone wetness", d.water.rootZoneWetness.v?.toFixed(2) ?? "—"]],
      sources: src(d.water.index.src, d.climate.rainfallDeviation.src, d.crops.src), followUps: [`Which crops are most profitable in ${d.name}?`],
    };
  }
  if (has(l, "loan", "lend", "credit", "bank")) {
    const b = lendingBand(d.lending.overall.v);
    return {
      title: `Lending risk view for ${d.name}`, reasons: [`Overall lending risk ${d.lending.overall.v}/100: ${b.label}.`, b.hint,
        "This is decision support; the credit decision stays with your credit committee."],
      facts: [["Climate risk", `${d.lending.climate.v}`], ["Crop risk", `${d.lending.crop.v}`], ["Market risk", `${d.lending.market.v}`], ["Yield risk", `${d.lending.yield.v}`]],
      sources: src(d.lending.overall.src), followUps: [`What is the insurance risk in ${d.name}?`],
    };
  }
  if (has(l, "insur", "risk", "drought", "flood")) {
    return {
      title: `Climate and insurance risk in ${d.name}`,
      reasons: [`Drought risk ${d.insurance.drought.v}/100, flood risk ${d.insurance.flood.v}/100, yield volatility ${d.insurance.yieldVolatility.v}/100.`,
        `Overall insurance risk ${d.insurance.overall.v}/100 (${lvl(d.insurance.overall.v)}).`, `Heat stress: ${d.climate.heatStress.v}.`],
      facts: [["Climate stability", `${d.climate.stability.v}%`], ["Flood outlook, 7 days", d.climate.floodNext7.v]],
      sources: src(d.insurance.overall.src, d.climate.stability.src), followUps: [`What should I cultivate in ${d.name} for ${s}?`],
    };
  }
  if (has(l, "oversupply", "saturat")) {
    const hot = national.filter((x) => x.market.saturation.v.risk === "High");
    const byCrop = new Map<string, string[]>();
    hot.forEach((x) => byCrop.set(x.market.saturation.v.crop, [...(byCrop.get(x.market.saturation.v.crop) ?? []), x.name]));
    return {
      title: `Oversupply risk at ${s} harvest`, ranked: [...byCrop].sort((a, b) => b[1].length - a[1].length)
        .map(([c, ds]) => `${cropName(c)} (${ds.length} district${ds.length > 1 ? "s" : ""}): ${ds.slice(0, 5).join(", ")}${ds.length > 5 ? ` and ${ds.length - 5} more` : ""}`),
      reasons: hot.length ? ["Districts where many growers are expected to plant the same crop, putting pressure on harvest prices."] : ["No district shows a high saturation risk."],
      facts: [], sources: src(...national.map((x) => x.market.saturation.src)), followUps: ["Which districts are strongest this season?"],
    };
  }
  if (has(l, "which district", "best district", "where should", "strongest")) {
    const ranked = national.slice().sort((a, b) => b.crops.v[0].opportunity - a.crops.v[0].opportunity).slice(0, 5);
    return {
      title: `Strongest districts for ${s}`, ranked: ranked.map((x) => `${x.name}: ${cropName(x.crops.v[0].crop)} (${x.crops.v[0].opportunity}/100)`),
      reasons: ["Ranked by the Agricultural Opportunity Score of each district's leading crop."], facts: [], sources: src(...ranked.map((x) => x.crops.src)),
      followUps: [`What should I cultivate in ${ranked[0].name} for ${s}?`],
    };
  }
  if (has(l, "demand", "market", "price")) {
    const sat = d.market.saturation.v;
    return {
      title: `Market outlook at ${s} harvest`, reasons: [`Market demand for the leading crop: ${d.market.demand.v}.`,
        `Saturation risk: ${cropName(sat.crop)} (${sat.risk}). ${sat.reason}`, `Price trend into harvest: ${d.market.priceTrend.v}.`],
      facts: [["Harvest month", MONTHS[SEASON_INFO[d.season].harvestMonth - 1]]],
      sources: src(d.market.demand.src), followUps: ["Which districts will have oversupply?"],
    };
  }
  if (has(l, "profit", "roi", "income", "revenue")) {
    const byProfit = crops.slice().sort((a, b) => b.profitHa - a.profitHa).slice(0, 4);
    return {
      title: `Most profitable crops in ${d.name}, ${s} (per hectare)`, ranked: byProfit.map((c) => `${cropName(c.crop)}: LKR ${c.profitHa.toLocaleString()} profit, ROI ${c.roi}%`),
      reasons: ["Profit = expected yield × expected price − production cost."], facts: [], sources: src(d.crops.src),
      followUps: [`How much water will ${cropName(byProfit[0].crop).toLowerCase()} need in ${d.name}?`],
    };
  }
  if (has(l, "when", "sow", "start")) {
    return {
      title: `When to start cultivation in ${d.name}`, reasons: [`${s} sowing window: ${SEASON_INFO[d.season].sowing}.`,
        `Plan land preparation 2–3 weeks before the onset of seasonal rains; ${top ? `${cropName(top.crop)} is the leading option.` : ""}`],
      facts: [], sources: ["demo"], followUps: [`What should I cultivate in ${d.name} for ${s}?`],
    };
  }
  // default: what to cultivate
  const good = crops.filter((c) => !d.avoid.v.includes(c.crop)).slice(0, 3);
  const reasons = [
    good.some((c) => c.waterMm < 450) ? "Lower water requirement than the alternatives." : "Good fit with the season's water supply.",
    d.climate.rainfallDeviation.v < -5 ? `Rainfall is running ${Math.abs(d.climate.rainfallDeviation.v)}% below normal.` : "Rainfall close to or above normal.",
    good[0]?.roi > 60 ? "Strong projected ROI." : "Moderate projected ROI.",
  ];
  const plan = ha > 0 ? allocate(crops, ha).map((a) => `${a.pct}% ${cropName(a.crop)} (${a.ha} ha)`).join(", ") : null;
  return {
    title: `Recommended for ${d.name}, ${s}`, ranked: good.map((c) => `${cropName(c.crop)} — opportunity ${c.opportunity}/100`), reasons,
    facts: [["Climate risk", lvl(d.insurance.overall.v)], ["Profitability rank", good[0] && good[0].profitability >= 70 ? "High" : "Moderate"],
      ...(d.avoid.v.length ? [["Avoid", d.avoid.v.map(cropName).join(", ")] as [string, string]] : []), ...(plan ? [["Suggested land split", plan] as [string, string]] : [])],
    sources: src(d.crops.src, d.climate.rainfallDeviation.src), followUps: [`What is the expected profit in ${d.name}?`, `How much water will be required?`, "Which districts will have oversupply?"],
  };
}
