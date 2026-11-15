# NASA Data Kit: Sri Lanka

This kit downloads the NASA datasets you chose for all 25 districts of Sri Lanka:
- SMAP
- GPM IMERG
- NASA POWER
- ECOSTRESS
- Landsat and MODIS
- SRTM

It writes them into **one JSON file** that your existing website reads. Your website stays as it is: you add a data file and, if you want it, a ready-made panel.

```
NASA servers ──► python -m nasa_kit all ──► output/sri_lanka_nasa.json ──► your website
                 (runs on your PC/server)     output/…observations.csv      (public/data/)
```

## 1. What you get

| Dataset | What it gives each district | Resolution | Updated | Share of the scores |
|---|---|---|---|---|
| **NASA POWER** | Temperature, rain, humidity, sun, wind (last 30 days) and 2001–2020 normals for Maha and Yala | ~50 km | daily | **32.5%** |
| **SMAP** (L4 + L3) | Root-zone soil wetness, surface soil moisture, water stress | 9 km | daily | **20%** |
| **MODIS NDVI** | Vegetation greenness and change versus past years | 250 m | 16 days | **15%** |
| **Landsat (HLS)** | NDVI for **your own farm polygons** (optional) | 30 m | 2–4 days | inside the MODIS share for farms |
| **ECOSTRESS** | Land surface temperature, heat stress, evapotranspiration | 70 m | each overpass | **12.5%** |
| **GPM IMERG** | 30-day rainfall, anomaly versus normal, heavy-rain days | ~11 km | daily (Final replaces Late) | **10%** |
| **SRTM** | Mean, min and max elevation and ruggedness | 90 m | static | **10%** |

**How the percentages are worked out.** The kit computes two scores per district and weights them equally:
- **Crop suitability:**
  - NASA POWER rainfall: 35%
  - NASA POWER temperature: 30%
  - SMAP: 15%
  - SRTM elevation: 10%
  - SRTM ruggedness: 10%
- **Crop condition:**
  - MODIS vegetation: 30%
  - ECOSTRESS heat/water: 25%
  - SMAP soil water: 25%
  - GPM rainfall: 20%

The weights are in `nasa_kit/catalog.py`, and they are also written into the JSON.

**No invented numbers.** If NASA hasn't delivered a value yet, the field is `null` and the panel shows "Not loaded yet". If a score is missing some inputs, it is calculated from the inputs it has, and the JSON lists what's missing (`crop_condition.missing`).

## 2. Set up (Windows, about 10 minutes)

1. Install **Python 3.11+** from python.org. During setup, tick "Add python.exe to PATH".
2. Create a free **NASA Earthdata account** at https://urs.earthdata.nasa.gov.
3. In Earthdata, open **Profile → Generate Token** and copy the token. It is used for GPM IMERG.
4. Unzip this kit, open **PowerShell** in the folder, and run:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
copy .env.example .env
notepad .env                           # fill EARTHDATA_USERNAME, EARTHDATA_PASSWORD, EARTHDATA_TOKEN
python -m nasa_kit status              # checks your credentials
```

On macOS or Linux, use `source .venv/bin/activate` and `cp` instead.

## 3. Download the data

```powershell
python -m nasa_kit all --wait 90
```

This runs five steps:
1. NASA POWER.
2. GPM IMERG.
3. Sends requests to NASA AppEEARS for SMAP, MODIS (with 4 years of history for "versus normal"), ECOSTRESS and SRTM.
4. Waits up to 90 minutes for those requests.
5. Writes `output/sri_lanka_nasa.json` and `output/sri_lanka_nasa_observations.csv`.

**AppEEARS queues requests.** They usually take 10 minutes to a few hours. If the wait runs out, nothing is lost: run these later.
```powershell
python -m nasa_kit collect     # picks up finished requests
python -m nasa_kit export      # rewrites the JSON
```

**Your own farms (Landsat 30 m).** Draw farm polygons, for example at geojson.io. Give each a `name` property and save as `farms.geojson`. Then run:
```powershell
python -m nasa_kit submit --datasets landsat_ndvi --farms farms.geojson
```
See `examples_farms.geojson` for the format.

**Individual commands:**

| Command | What it does |
|---|---|
| `power` | NASA POWER, no account needed |
| `gpm --days 30` | GPM IMERG Late |
| `gpm --final --days 200` | GPM IMERG Final, the research-quality version, delayed about 3.5 months |
| `submit` | Sends the AppEEARS requests |
| `collect --wait 60` | Downloads finished AppEEARS results |
| `export` | Writes the JSON and CSV |
| `status` | Shows what's loaded |

### Keep it fresh automatically
Use Windows **Task Scheduler** to run a daily task:
- **Program:** `C:\path\to\kit\.venv\Scripts\python.exe`
- **Arguments:** `-m nasa_kit all --wait 30`
- **Start in:** the kit folder

Then copy `output\sri_lanka_nasa.json` to your website (step 4). On Linux, use cron: `30 5 * * * cd /kit && .venv/bin/python -m nasa_kit all --wait 30 && cp output/sri_lanka_nasa.json /var/www/site/public/data/`.

## 4. Connect it to your website

Choose **one** option.

### Option A: static file (simplest; works with any host)
Copy `output/sri_lanka_nasa.json` into your site's public folder, for example `public/data/sri_lanka_nasa.json` in Next.js, React or Vite. The file is about 50 KB and is served like an image. There's no server to run.

### Option B: small API (if you want live queries)
```powershell
python -m nasa_kit serve --port 8090
```

| Endpoint | Returns |
|---|---|
| `GET /districts` | All districts |
| `GET /districts/Kandy` | One district (the code `LK-21` also works) |
| `GET /national?metric=ndvi` | Latest value per district, for colouring a map |
| `GET /series/Galle?metric=precip_mm&days=180` | Time series for charts |
| `GET /datasets` | Source status and weights |

CORS is open for GET requests. Metrics: `precip_mm, ndvi, lst_c, et_daily, smap_rootzone_wetness, smap_surface_sm, elevation_mean, elevation_std, t2m, t2m_max, rh2m, solar_kwh_m2, wind_ms`.

### React or Next.js
Copy `web/react/` into your project, for example `src/components/nasa/`:

```tsx
import { DistrictNasaPanel } from "@/components/nasa/DistrictNasaPanel";

<DistrictNasaPanel district="Anuradhapura" />                         // Option A
<DistrictNasaPanel district="LK-71" url="http://127.0.0.1:8090" />    // Option B
```

To use your own design, take only the data:
```ts
import { useNasaDistrict } from "@/components/nasa/useNasaDistrict";
const { district } = useNasaDistrict("Kandy");
district?.smap.root_zone_wetness;   district?.gpm_imerg.rain_30_days;   district?.crop_condition.score;
```

To colour your map:
```ts
import { loadNasaDataset, choropleth, PICKERS } from "@/components/nasa/nasa-kit";
const values = choropleth(await loadNasaDataset(), PICKERS.condition); // { "Kandy": 71.2, ... }
```

### AgriSphere pages
`web/react/agrisphere-adapter.ts` fills the AgriSphere `DistrictIntel` with real NASA values:
- rain anomaly from GPM
- heat stress from ECOSTRESS
- root-zone wetness from SMAP
- Maha and Yala normals from POWER
- the `eo` block from MODIS, SRTM and condition

Each value it fills is marked `src: "live"`. Anything NASA hasn't delivered keeps its demo label.
```ts
const intel = mergeNasaIntoDistrict(demoDistrict(id, name, provinceId, season), await loadNasaDataset());
```

### Plain HTML, WordPress or PHP
Upload `web/html/nasa-district.html` and `sri_lanka_nasa.json` to the same folder. It includes a dropdown of all 25 districts. In WordPress, paste the `<script>` and markup into a Custom HTML block and set `DATA_URL` to the uploaded JSON's address.

### Try the layout before downloading real data
`web/sample/sri_lanka_nasa.DEMO.json` is a **sample file from the kit's test server, not NASA data**. It has `"demo": true`, and the panel shows a yellow "sample data" banner while it's in use. The AgriSphere adapter ignores it. Replace it with your own `output/sri_lanka_nasa.json` before going live.

## 5. Files in the output

- `sri_lanka_nasa.json`: one entry per district. See `DATA.md` for every field.
- `sri_lanka_nasa_observations.csv`: every stored value in long format (`dataset, place, date, metric, value, units`), for Excel, Power BI or pandas.
- `nasa_kit.sqlite`: the local store. Re-runs only add or update values, so history builds up over time.

## 6. Troubleshooting

| Message | Fix |
|---|---|
| `EARTHDATA_USERNAME / EARTHDATA_PASSWORD are not set` | Fill in `.env` in the kit folder. |
| `login failed (HTTP 401)` | Check the password. Log in at urs.earthdata.nasa.gov once to accept the terms. |
| GPM: `got HTML instead of data` | The token has expired (tokens last 60 days). Generate a new one. Also authorize **"NASA GESDISC DATA ARCHIVE"** under Applications → Authorized Apps in Earthdata. |
| `only 12 of 30 days stored` | Run `python -m nasa_kit gpm --days 35`. |
| MODIS "needs 2 years of history" | Run `python -m nasa_kit submit --datasets modis_ndvi --ndvi-years 4`, then `collect`. |
| ECOSTRESS empty for a district | The ISS overpass was cloudy or there was no pass in the window. Re-run `submit` next week. |

NASA product versions change over time. The kit picks the newest version AppEEARS offers from the list in `catalog.py`.

## 7. Credits (show them on your site)
NASA POWER (NASA LaRC); GPM IMERG (NASA/JAXA, GES DISC); SMAP (NASA, NSIDC DAAC); MODIS, Landsat HLS, ECOSTRESS and SRTM (NASA LP DAAC, via AppEEARS). District boundaries: Department of Census & Statistics / HDX, via lk_admin_regions (MIT). The JSON's `attribution` field has this text.

## 8. Tests
```
pip install -r requirements-dev.txt
python -m pytest -q
```
The tests run offline, using fixtures in NASA's documented formats.
