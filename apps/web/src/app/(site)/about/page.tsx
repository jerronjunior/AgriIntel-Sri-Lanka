import type { Metadata } from "next";
export const metadata: Metadata = { title: "About" };

const SECTIONS = [
  { h: "Mission", p: "Sri Lankan agriculture runs on two monsoon seasons that are becoming harder to predict. AgriIntel's mission is to put the best freely available Earth observation data in the hands of the organizations that finance, insure, plan and grow the country's crops." },
  { h: "How we use NASA data", p: "The NASA POWER project provides daily meteorology and solar data built from MERRA-2 reanalysis and CERES satellite observations, plus 20-year climatologies. AgriIntel fetches these through POWER's public API, caches them and records the source on every value. GPM IMERG rainfall and SMAP soil moisture are integrated through NASA Earthdata, which requires an Earthdata Login account. Sentinel-2 imagery comes from the EU's Copernicus programme, not NASA." },
  { h: "Agricultural intelligence, explained", p: "We start with transparent rules and documented parameters, then add machine learning only where labelled historical data can be used to train and evaluate it. A model's accuracy is published only after it has been tested on years it never saw." },
  { h: "Climate adaptation", p: "Scenario tools let users ask what happens with 20% less rain or one degree more heat, and compare crops that cope better. The aim is preparation, not prediction theatre." },
  { h: "Sustainable agriculture", p: "Matching crops to water availability reduces irrigation pressure and crop failure. Knowing the water deficit in cubic metres makes it possible to plan around it." },
];

export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-20">
      <h1 className="text-5xl font-semibold">Why AgriIntel exists</h1>
      {SECTIONS.map((s) => (<section key={s.h} className="mt-12"><h2 className="text-2xl font-semibold">{s.h}</h2><p className="mt-3 text-lg leading-relaxed text-muted">{s.p}</p></section>))}
      <p className="mt-14 border-t border-line pt-6 text-sm text-muted">These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.</p>
    </div>
  );
}
