"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import DistrictSelect from "@/components/app/DistrictSelect";
import { DataTag, ErrorState, Label, Panel, ProvenanceNote } from "@/components/ui/kit";
import { api } from "@/lib/api";
import { fmt } from "@/lib/hooks";
import type { CropResult, Provenance } from "@/lib/types";

type Rec = { recommended: string; second_best: string | null; avoid: string[]; ranking: CropResult[]; explanation: string; disclaimer: string; inputs: Record<string, unknown>; provenance: Provenance | null; crop_parameters_reviewed: boolean };
const CLS: Record<string, string> = { "highly suitable": "text-emerald", suitable: "text-cyan", marginal: "text-amber", "not suitable": "text-rose" };

function Crops() {
  const sp = useSearchParams();
  const [district, setDistrict] = useState(sp.get("district") ?? "Anuradhapura");
  const [season, setSeason] = useState<"maha" | "yala">("yala");
  const [irrigation, setIrrigation] = useState("none");
  const m = useMutation({ mutationFn: () => api<Rec>("/recommendations", { body: { district, season, irrigation } }) });
  const r = m.data;
  const nameOf = (k: string | null) => r?.ranking.find((x) => x.crop === k)?.name ?? k;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div><h1 className="text-3xl font-semibold">Crop suitability</h1><p className="mt-1 max-w-3xl text-muted">A transparent rules model scores each crop against the district&apos;s 2001–2020 seasonal climate. It explains every score and is not a trained AI prediction.</p></div>
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="panel grid items-end gap-4 p-4 sm:grid-cols-4">
        <div><Label htmlFor="district">District</Label><DistrictSelect value={district} onChange={setDistrict} /></div>
        <div><Label htmlFor="s">Season</Label><select id="s" className="field" value={season} onChange={(e) => setSeason(e.target.value as "maha")}><option value="maha">Maha</option><option value="yala">Yala</option></select></div>
        <div><Label htmlFor="i">Irrigation</Label><select id="i" className="field" value={irrigation} onChange={(e) => setIrrigation(e.target.value)}><option value="none">None (rain-fed)</option><option value="partial">Partial</option><option value="full">Full</option></select></div>
        <button className="btn btn-primary" disabled={m.isPending}>{m.isPending ? "Scoring…" : "Rank crops"}</button>
      </form>
      {m.isError && <ErrorState error={m.error} onRetry={() => m.mutate()} />}
      {r && (<>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel border-emerald/50 p-5"><p className="text-sm text-muted">Recommended</p><p className="font-display text-3xl font-semibold">{nameOf(r.recommended)}</p></div>
          <div className="panel p-5"><p className="text-sm text-muted">Second best</p><p className="font-display text-3xl font-semibold">{nameOf(r.second_best) ?? "—"}</p></div>
          <div className="panel p-5"><p className="text-sm text-muted">Avoid</p><p className="font-display text-xl font-semibold">{r.avoid.length ? r.avoid.map(nameOf).join(", ") : "None flagged"}</p></div>
        </div>
        <Panel title="Ranking" tag="historical">
          <p className="mb-4">{r.explanation}</p>
          <p className="mb-4 text-sm text-muted">Climate used: {fmt(r.inputs.mean_temp_c as number, 1)} °C mean, {fmt(r.inputs.rainfall_mm as number)} mm seasonal rainfall, elevation {fmt(r.inputs.elevation_m as number)} m ({String(r.inputs.climate_source)}).</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-muted"><th className="py-2">Crop</th><th>Score</th><th>Class</th><th>Temperature</th><th>Water</th><th>Elevation</th><th>Water deficit</th></tr></thead>
            <tbody>{r.ranking.map((c) => (
              <tr key={c.crop} className="border-t border-line align-top">
                <td className="py-2 font-medium">{c.name}</td>
                <td className="tabular"><div className="flex items-center gap-2">{fmt(c.score)}<div className="h-1.5 w-16 rounded-full bg-panel-2"><div className="h-full rounded-full bg-emerald" style={{ width: `${c.score}%` }} /></div></div></td>
                <td className={`capitalize ${CLS[c.class]}`}>{c.class}</td>
                <td className="tabular">{fmt(c.factors.temperature)}</td><td className="tabular">{fmt(c.factors.water)}</td><td className="tabular">{fmt(c.factors.elevation)}</td>
                <td className="tabular">{fmt(c.water_balance.deficit_mm)} mm</td>
              </tr>))}</tbody></table></div>
          <div className="mt-4 space-y-2 text-sm">{r.ranking.filter((c) => c.constraints.length).map((c) => <p key={c.crop}><span className="font-semibold">{c.name}:</span> <span className="text-muted">{c.constraints.join("; ")}</span></p>)}</div>
          {!r.crop_parameters_reviewed && <p className="mt-4 rounded-lg border border-amber/30 bg-amber/5 p-3 text-sm">Crop parameters are indicative defaults that haven&apos;t been reviewed against Department of Agriculture recommendations yet. {r.disclaimer}</p>}
          <ProvenanceNote p={r.provenance} />
        </Panel>
      </>)}
      <p className="flex items-center gap-2 text-xs text-muted"><DataTag kind="historical" /> inputs are long-term normals, so this is a typical-season ranking, not a forecast for this year.</p>
    </div>
  );
}
export default function Page() { return <Suspense><Crops /></Suspense>; }
