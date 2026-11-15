# AgriSphere district intelligence: integration guide

Adds a Sri Lanka map that drills down from 9 provinces → 25 districts → a full district decision package.

## Files (copy into your project at the same paths)

```
apps/web/public/geo/lk-admin.topo.json              9 provinces + 25 districts (135 KB TopoJSON)
apps/web/scripts/build-lk-admin.mjs                 regenerates the file above from source GeoJSON
apps/web/src/lib/agrisphere/model.ts                data model, demo values, opportunity score, land allocation
apps/web/src/lib/agrisphere/live.ts                 merges live AgriIntel API data (NASA POWER) into the model
apps/web/src/lib/agrisphere/copilot.ts              rules-based copilot answers from the same data
apps/web/src/components/agrisphere/SriLankaMap.tsx  SVG map: choropleth, animated zoom, keyboard access, legend
apps/web/src/components/agrisphere/DistrictPanel.tsx opportunity score, decision package, 10 module tabs
apps/web/src/components/agrisphere/Explorer.tsx     levels, season switch, metric switch, national/province views
apps/web/src/app/(site)/agrisphere/page.tsx         public page  → /agrisphere          (demo data, clearly labelled)
apps/web/src/app/app/intelligence/page.tsx          dashboard page → /app/intelligence  (live NASA data where available)
apps/web/e2e/agrisphere.spec.ts                     Playwright tests
```

Uses packages already in the project: `d3-geo`, `topojson-client`, `@tanstack/react-query`, `lucide-react`,
and the existing `@/lib/api`, `@/lib/auth-store` and theme classes in `globals.css`. Nothing new to install.
(`topojson-server` and `topojson-simplify` are only needed if you re-run the boundary build script.)

## Add the menu links

Public site, `src/components/marketing/SiteChrome.tsx`, in `NAV`:
```ts
{ href: "/agrisphere", label: "AgriSphere" },
```

Dashboard, `src/components/app/AppShell.tsx`: add `MapPinned` to the lucide-react import, then in `NAV`:
```ts
{ href: "/app/intelligence", label: "District intelligence", icon: MapPinned, feature: "map" },
```

## How to use it

* Click a province (or Tab + Enter) to zoom in to its districts; click a district for its decision package.
* `Esc` or the breadcrumb goes back a level. Switch Maha / Yala and the map colouring at the top.
* Tabs: Climate, Water, Soil, Crops (with a land diversification plan), Yield & profit, Market, Export, Insurance,
  Lending, Copilot.

## Where the data comes from

Every value is tagged:

| Tag | Meaning |
|---|---|
| Live | From the AgriIntel API (NASA POWER) — dashboard only |
| Partly demo | Live suitability and water need, demo yield/market/price |
| Demo | Illustrative until a real source is connected |
| Not connected | No source and no demo value |

Live today (dashboard): 30-day rainfall deviation, season temperature and rainfall normals, root-zone soil wetness,
crop suitability ranking, crops to avoid, and per-crop water requirement.

Still demo (needs a data source): climate stability, heat stress, monthly drought and 7-day flood outlook, reservoir and
groundwater, soil group and soil health, yield ranges, prices and profit, market demand and saturation, export supply,
insurance and lending scores. To connect one, fill the matching field in `mergeLive()` (`live.ts`) with
`{ v: value, src: "live", note: "source" }` — the UI picks up the tag automatically.

## Deliberate differences from the concept document

* **Lending** shows *Favourable / Review conditions / Elevated risk* instead of *Approve / Conditional / Reject*.
  The platform gives decision support; the credit decision stays with the lender (as in the original AgriIntel brief).
* **Insurance claims validation** lists which evidence histories are stored; it doesn't approve claims.
* **Copilot** composes answers from the page's data with sources tagged. It can be swapped for a server-side language
  model later by replacing `answer()` in `copilot.ts`.
* **Flood forecast** stays demo until a forecast feed (e.g. Department of Meteorology) is connected; historical
  observations are never shown as forecasts.

## Boundary data

`lk-admin.topo.json` is simplified from github.com/nuuuwan/lk_admin_regions (MIT licence), which is built from
Department of Census and Statistics and Humanitarian Data Exchange boundaries. Province and district codes follow the
DCS / ISO 3166-2:LK scheme (e.g. LK-8 Uva, LK-82 Monaragala). A credit line is shown under the map.
