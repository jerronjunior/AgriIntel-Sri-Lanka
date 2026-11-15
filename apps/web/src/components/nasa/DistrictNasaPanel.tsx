"use client";
/**
 * Drop-in panel that shows every NASA dataset for one district.
 *   import { DistrictNasaPanel } from "@/components/nasa/DistrictNasaPanel";
 *   <DistrictNasaPanel district="Anuradhapura" />            // reads /data/sri_lanka_nasa.json
 *   <DistrictNasaPanel district="LK-71" url="http://127.0.0.1:8090" />   // or the kit API
 * Styling: import "./nasa-panel.css" once (plain CSS, prefixed .nk-, no Tailwind needed).
 */
import type { ReactNode } from "react";
import type { NasaDistrict } from "./nasa-kit";
import { useNasaDistrict } from "./useNasaDistrict";
import "./nasa-panel.css";

const f = (v: number | null | undefined, d = 1, unit = "") => (v == null ? null : `${v.toFixed(d)}${unit}`);
const pct = (v: number | null | undefined) => (v == null ? null : `${v > 0 ? "+" : ""}${v.toFixed(0)}%`);

function Row({ label, value, hint }: { label: string; value: string | null; hint?: string | null }) {
  return (
    <div className="nk-row">
      <span className="nk-label">{label}</span>
      <span className={value == null ? "nk-value nk-missing" : "nk-value"}>{value ?? "Not loaded yet"}</span>
      {hint && <span className="nk-hint">{hint}</span>}
    </div>
  );
}

function Block({ title, source, date, children }: { title: string; source: string; date?: string | null; children: ReactNode }) {
  return (
    <section className="nk-block">
      <header>
        <h4>{title}</h4>
        <span className="nk-source">{source}{date ? `, ${date}` : ""}</span>
      </header>
      {children}
    </section>
  );
}

export function DistrictNasaView({ d, demo }: { d: NasaDistrict; demo?: boolean }) {
  const p = d.nasa_power.last_30_days;
  const rain = d.gpm_imerg.rain_30_days;
  const ndvi = d.modis.ndvi;
  const et = d.ecostress.evapotranspiration;
  const cc = d.crop_condition;
  return (
    <div className="nk-panel">
      {demo && <p className="nk-demo">Sample data for layout testing. Run the kit to load real NASA values.</p>}
      <div className={`nk-score nk-${cc.level}`}>
        <div>
          <span className="nk-score-n">{cc.score == null ? "–" : Math.round(cc.score)}</span>
          <span className="nk-score-of">/100</span>
        </div>
        <div>
          <strong>Crop condition: {cc.level === "unknown" ? "not enough data" : cc.level}</strong>
          <p>
            {d.name}, {d.province} Province.{" "}
            {cc.missing.length > 0 && cc.score != null && `Calculated without ${cc.missing.join(", ").replaceAll("_", " ")}.`}
          </p>
        </div>
      </div>

      <Block title="Rainfall, last 30 days" source="GPM IMERG" date={rain && rain.available ? rain.end : null}>
        {rain && rain.available ? (
          <>
            <Row label="Total" value={f(rain.total_mm, 0, " mm")} hint={rain.normal_mm != null ? `normal ${rain.normal_mm.toFixed(0)} mm` : null} />
            <Row label="Versus normal" value={pct(rain.anomaly_pct)} />
            <Row label="Wettest day" value={f(rain.wettest_day_mm, 0, " mm")} hint={`${rain.heavy_rain_days_50mm} days ≥ 50 mm`} />
          </>
        ) : (
          <Row label="Total" value={null} hint={rain && !rain.available ? rain.reason : null} />
        )}
      </Block>

      <Block title="Soil water" source="SMAP" date={d.smap.root_zone_date}>
        <Row label="Root zone wetness" value={f(d.smap.root_zone_wetness ?? d.smap.fallback_merra2_root_zone, 2)}
          hint={d.smap.fallback_merra2_root_zone != null ? "from MERRA-2 via NASA POWER until SMAP loads" : "0 = dry, 1 = saturated"} />
        <Row label="Surface soil moisture" value={f(d.smap.surface_soil_moisture_m3m3, 2, " m³/m³")} />
        <Row label="Water stress" value={d.smap.water_stress} />
      </Block>

      <Block title="Vegetation" source="MODIS NDVI" date={ndvi?.date}>
        <Row label="NDVI" value={f(ndvi?.ndvi, 2)} hint="0.2 sparse, 0.8 dense green" />
        <Row label="Versus same time in past years" value={ndvi?.anomaly != null ? `${ndvi.anomaly > 0 ? "+" : ""}${ndvi.anomaly.toFixed(2)}` : null}
          hint={ndvi && ndvi.anomaly == null ? `needs 2 years of history, has ${ndvi.baseline_years}` : null} />
      </Block>

      <Block title="Heat and crop water use" source="ECOSTRESS" date={d.ecostress.surface_temp_date}>
        <Row label="Land surface temperature" value={f(d.ecostress.surface_temp_c, 1, " °C")} />
        <Row label="Heat stress" value={d.ecostress.heat_stress} />
        <Row label="Evapotranspiration" value={f(et?.et, 1)} hint={et?.relative_to_usual_high != null ? `${Math.round(et.relative_to_usual_high * 100)}% of usual high` : null} />
      </Block>

      <Block title="Terrain" source="SRTM">
        <Row label="Mean elevation" value={f(d.srtm.elevation_mean, 0, " m")}
          hint={d.srtm.elevation_min != null ? `${d.srtm.elevation_min.toFixed(0)}–${d.srtm.elevation_max?.toFixed(0)} m` : null} />
        <Row label="Ruggedness (std. dev.)" value={f(d.srtm.elevation_std, 0, " m")} />
      </Block>

      <Block title="Weather" source="NASA POWER" date={p?.end}>
        <Row label="Mean temperature, 30 days" value={f(p?.mean_temp_c, 1, " °C")} hint={p?.max_temp_c != null ? `max ${p.max_temp_c.toFixed(1)} °C` : null} />
        <Row label="Humidity" value={f(p?.humidity_pct, 0, "%")} />
        <Row label="Solar radiation" value={f(p?.solar_kwh_m2, 1, " kWh/m²/day")} />
        <Row label="Maha normal rainfall" value={f(d.nasa_power.season_normals_2001_2020.maha?.rainfall_mm, 0, " mm")} hint="Oct–Feb, 2001–2020" />
        <Row label="Yala normal rainfall" value={f(d.nasa_power.season_normals_2001_2020.yala?.rainfall_mm, 0, " mm")} hint="Apr–Aug, 2001–2020" />
      </Block>
    </div>
  );
}

export function DistrictNasaPanel({ district, url }: { district: string; url?: string }) {
  const { loading, error, district: d, dataset } = useNasaDistrict(district, url);
  if (loading) return <div className="nk-panel nk-state">Loading NASA data…</div>;
  if (error) return <div className="nk-panel nk-state nk-error">{error}</div>;
  if (!d) return <div className="nk-panel nk-state">No NASA data for “{district}”. Use a district name such as Kandy or a code such as LK-21.</div>;
  return <DistrictNasaView d={d} demo={dataset?.demo} />;
}
