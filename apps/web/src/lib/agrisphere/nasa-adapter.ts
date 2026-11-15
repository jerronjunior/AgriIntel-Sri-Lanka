/**
 * For the AgriSphere pages: fill DistrictIntel with real NASA values from the kit.
 * Every value it sets is marked src "live"; anything NASA hasn't delivered keeps its original (demo) value and label.
 *
 *   const ds = await loadNasaDataset();
 *   intel = mergeNasaIntoDistrict(intel, ds);
 */
import type { DistrictIntel, Level3, S } from "@/lib/agrisphere/model";
import { findDistrict, type NasaDataset } from "@/components/nasa/nasa-kit";

const live = <T,>(v: T, note: string): S<T> => ({ v, src: "live", note });

export function mergeNasaIntoDistrict(intel: DistrictIntel, ds: NasaDataset): DistrictIntel {
  if (ds.demo) return intel; // never present the sample file as live
  const d = findDistrict(ds, intel.id) ?? findDistrict(ds, intel.name);
  if (!d) return intel;
  const out: DistrictIntel = structuredClone(intel);
  const rain = d.gpm_imerg.rain_30_days;
  const season = d.nasa_power.season_normals_2001_2020[intel.season];
  const wet = d.smap.root_zone_wetness ?? d.smap.fallback_merra2_root_zone;

  if (rain && rain.available && rain.anomaly_pct != null)
    out.climate.rainfallDeviation = live(Math.round(rain.anomaly_pct), `GPM IMERG, 30 days to ${rain.end}, vs NASA POWER normal`);
  if (season?.mean_temp_c != null) out.climate.meanTempC = live(season.mean_temp_c, "NASA POWER 2001–2020 normal");
  if (season?.rainfall_mm != null) out.climate.seasonRainMm = live(season.rainfall_mm, "NASA POWER 2001–2020 normal");
  if (d.ecostress.heat_stress) {
    const h: Level3 = d.ecostress.heat_stress === "high" ? "High" : d.ecostress.heat_stress === "medium" ? "Medium" : "Low";
    out.climate.heatStress = live(h, `ECOSTRESS ${d.ecostress.surface_temp_c?.toFixed(1)} °C on ${d.ecostress.surface_temp_date}`);
  }
  if (wet != null) {
    out.water.rootZoneWetness = live(wet, d.smap.root_zone_wetness != null ? `SMAP L4, ${d.smap.root_zone_date}` : "MERRA-2 via NASA POWER");
    const ws: Level3 = wet < 0.25 ? "Low" : wet < 0.4 ? "Medium" : "High";
    out.climate.waterSecurity = live(ws, "from root-zone soil wetness");
  }
  if (rain && rain.available)
    out.climate.floodNext7 = rain.heavy_rain_days_50mm >= 3
      ? live<Level3>("High", "≥3 days of 50 mm+ rain in the last 30 days (GPM IMERG). Not a forecast.")
      : out.climate.floodNext7;

  return out;
}
