/**
 * NASA Data Kit — types + loader for sri_lanka_nasa.json (or the kit's API).
 * Copy this file into your website (e.g. src/lib/nasa-kit.ts). No dependencies.
 *
 *   Option A (static file): copy output/sri_lanka_nasa.json → public/data/sri_lanka_nasa.json
 *   Option B (API):         python -m nasa_kit serve  → set NASA_KIT_URL to http://127.0.0.1:8090
 */

export type SourceKey =
  | "nasa_power" | "gpm_imerg_late" | "gpm_imerg_final" | "smap_l4_rootzone" | "smap_l3_surface"
  | "modis_ndvi" | "landsat_ndvi" | "ecostress_lst" | "ecostress_et" | "srtm";

export type SourceStatus = {
  title: string; mission: string; resolution: string; cadence: string; needs: string;
  values_stored: number; latest_observation: string | null; last_success_at: string | null;
  last_error: string | null; status: "loaded" | "error" | "not loaded";
};

export type SeasonNormals = { mean_temp_c: number | null; rainfall_mm: number | null };

export type NasaDistrict = {
  name: string; code: string; province: string; lat: number; lon: number;
  nasa_power: {
    last_30_days: { days: number; end: string; mean_temp_c: number; max_temp_c: number | null; rain_mm: number | null;
      humidity_pct: number | null; solar_kwh_m2: number | null; wind_ms: number | null } | null;
    season_normals_2001_2020: Partial<Record<"maha" | "yala", SeasonNormals>>;
    grid_elevation_m: number | null;
  };
  gpm_imerg: {
    rain_30_days:
      | { available: true; start: string; end: string; total_mm: number; heavy_rain_days_50mm: number; wettest_day_mm: number;
          normal_mm: number | null; anomaly_pct: number | null; sources: string[] }
      | { available: false; reason: string }
      | null;
  };
  smap: { root_zone_wetness: number | null; root_zone_date: string | null; surface_soil_moisture_m3m3: number | null;
    water_stress: "high" | "moderate" | "low" | null; fallback_merra2_root_zone: number | null };
  modis: { ndvi: { ndvi: number; date: string; baseline_years: number; normal?: number; anomaly?: number } | null };
  ecostress: { surface_temp_c: number | null; surface_temp_date: string | null; heat_stress: "high" | "medium" | "low" | null;
    evapotranspiration: { et: number; date: string; relative_to_usual_high: number | null } | null };
  srtm: { elevation_mean: number | null; elevation_std: number | null; elevation_max: number | null; elevation_min: number | null };
  crop_suitability_inputs: { rainfall_normal_mm: Partial<Record<"maha" | "yala", SeasonNormals>>; soil_moisture_root: number | null;
    soil_moisture_source: string | null; elevation_m: number | null; elevation_source: string | null; terrain_std_m: number | null };
  crop_condition: { score: number | null; level: "good" | "fair" | "poor" | "unknown";
    components: Partial<Record<"vegetation" | "heat_water" | "soil_water" | "rainfall", number>>;
    weights_used: Record<string, number>; missing: string[] };
};

export type NasaFarm = { latest_ndvi: number; date: string; series: { date: string; ndvi: number }[] };

export type NasaDataset = {
  generated_at: string; kit_version: string; country: "Sri Lanka"; attribution: string;
  /** true only for the bundled sample file — never show it to users as real data */
  demo?: boolean;
  weights: { crop_suitability: Record<string, number>; crop_condition: Record<string, number> };
  sources: Record<SourceKey, SourceStatus>;
  districts: Record<string, NasaDistrict>;
  farms: Record<string, NasaFarm>;
};

const DEFAULT_URL = process.env.NEXT_PUBLIC_NASA_KIT_URL || "/data/sri_lanka_nasa.json";
let cache: { url: string; at: number; data: Promise<NasaDataset> } | null = null;

/** Load the whole dataset once (cached 10 min). Pass an API base URL (Option B) or a JSON URL (Option A). */
export function loadNasaDataset(url: string = DEFAULT_URL): Promise<NasaDataset> {
  if (cache && cache.url === url && Date.now() - cache.at < 600_000) return cache.data;
  const isApi = !url.endsWith(".json");
  const data = (async () => {
    if (!isApi) {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) throw new Error(`NASA dataset not found at ${url} (HTTP ${r.status}). Run "python -m nasa_kit export" and copy the file.`);
      return (await r.json()) as NasaDataset;
    }
    const base = url.replace(/\/$/, "");
    const [meta, districts] = await Promise.all([fetch(`${base}/datasets`).then(okJson), fetch(`${base}/districts`).then(okJson)]);
    return { ...meta, country: "Sri Lanka", kit_version: "api", districts, farms: {} } as NasaDataset;
  })();
  cache = { url, at: Date.now(), data };
  data.catch(() => (cache = null));
  return data;
}

async function okJson(r: Response) {
  if (!r.ok) throw new Error(`NASA Data Kit API error HTTP ${r.status}`);
  return r.json();
}

/** Case-insensitive lookup; also accepts the district code (LK-11 … LK-92). */
export function findDistrict(ds: NasaDataset, nameOrCode: string): NasaDistrict | null {
  const k = nameOrCode.trim().toLowerCase();
  return Object.values(ds.districts).find((d) => d.name.toLowerCase() === k || d.code.toLowerCase() === k) ?? null;
}

/** Values for colouring a map: district name → number (null when NASA has no value yet). */
export function choropleth(ds: NasaDataset, pick: (d: NasaDistrict) => number | null | undefined): Record<string, number | null> {
  return Object.fromEntries(Object.values(ds.districts).map((d) => [d.name, pick(d) ?? null]));
}

export const PICKERS = {
  condition: (d: NasaDistrict) => d.crop_condition.score,
  ndvi: (d: NasaDistrict) => d.modis.ndvi?.ndvi ?? null,
  ndviAnomaly: (d: NasaDistrict) => d.modis.ndvi?.anomaly ?? null,
  rain30: (d: NasaDistrict) => (d.gpm_imerg.rain_30_days && d.gpm_imerg.rain_30_days.available ? d.gpm_imerg.rain_30_days.total_mm : null),
  rainAnomaly: (d: NasaDistrict) => (d.gpm_imerg.rain_30_days && d.gpm_imerg.rain_30_days.available ? d.gpm_imerg.rain_30_days.anomaly_pct : null),
  soilWetness: (d: NasaDistrict) => d.smap.root_zone_wetness ?? d.smap.fallback_merra2_root_zone,
  surfaceTemp: (d: NasaDistrict) => d.ecostress.surface_temp_c,
  elevation: (d: NasaDistrict) => d.srtm.elevation_mean,
} satisfies Record<string, (d: NasaDistrict) => number | null | undefined>;
