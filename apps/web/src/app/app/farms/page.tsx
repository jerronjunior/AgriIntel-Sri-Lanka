"use client";
import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import DistrictSelect from "@/components/app/DistrictSelect";
import { Empty, ErrorState, Label, Panel, Skeleton } from "@/components/ui/kit";
import { api, ApiError } from "@/lib/api";
import { fmt, useOrgQuery } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-store";
import type { Farm } from "@/lib/types";

export default function Farms() {
  const orgId = useAuth((s) => s.orgId);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("Anuradhapura");
  const [err, setErr] = useState<string | null>(null);
  const farms = useOrgQuery<{ items: Farm[]; total: number }>(["farms", q], `/farms?page_size=200${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const refresh = () => { qc.invalidateQueries({ queryKey: [orgId, "farms"] }); qc.invalidateQueries({ queryKey: [orgId, "farms-geo"] }); };
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(null);
    const form = e.currentTarget;
    const f = new FormData(form);
    try { await api("/farms", { body: { name: f.get("name"), district, latitude: +f.get("lat")!, longitude: +f.get("lon")!, irrigation: f.get("irrigation") } }); form.reset(); refresh(); }
    catch (x) { setErr((x as ApiError).message); }
  }
  async function del(id: string) { if (!confirm("Delete this farm?")) return; try { await api(`/farms/${id}`, { method: "DELETE" }); refresh(); } catch (x) { setErr((x as ApiError).message); } }
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-3xl font-semibold">Farms</h1><Link href="/app/map" className="btn btn-ghost">Draw a boundary on the map</Link></div>
      <Panel title="Add a farm by coordinates">
        <form onSubmit={create} className="grid items-end gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2"><Label htmlFor="n">Name</Label><input id="n" name="name" required className="field" /></div>
          <div><Label htmlFor="district">District</Label><DistrictSelect value={district} onChange={setDistrict} /></div>
          <div><Label htmlFor="lat">Latitude</Label><input id="lat" name="lat" type="number" step="any" min={5.7} max={10} required className="field" /></div>
          <div><Label htmlFor="lon">Longitude</Label><input id="lon" name="lon" type="number" step="any" min={79.4} max={82.1} required className="field" /></div>
          <div><Label htmlFor="ir">Irrigation</Label><select id="ir" name="irrigation" className="field"><option value="none">None</option><option value="partial">Partial</option><option value="full">Full</option></select></div>
          <button className="btn btn-primary sm:col-span-6 sm:w-fit">Add farm</button>
        </form>
        {err && <p role="alert" className="mt-3 text-sm text-rose">{err}</p>}
      </Panel>
      <Panel title={`Portfolio (${farms.data?.total ?? 0})`} actions={<input aria-label="Search farms" placeholder="Search by name" className="field !w-56 !py-1.5" value={q} onChange={(e) => setQ(e.target.value)} />}>
        {farms.isLoading && <Skeleton />}
        {farms.isError && <ErrorState error={farms.error} onRetry={() => farms.refetch()} />}
        {farms.data && !farms.data.items.length && <Empty title="No farms yet">Add one above, draw a boundary on the map or import a GeoJSON file.</Empty>}
        {!!farms.data?.items.length && <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-muted"><th className="pb-2">Name</th><th>District</th><th>Area</th><th>Irrigation</th><th>Location</th><th /></tr></thead>
          <tbody>{farms.data.items.map((f) => (
            <tr key={f.id} className="border-t border-line"><td className="py-2 font-medium">{f.name}</td><td>{f.district}</td><td className="tabular">{f.area_ha ? `${fmt(f.area_ha, 2)} ha` : "No boundary"}</td><td className="capitalize">{f.irrigation}</td>
              <td className="tabular text-muted">{f.latitude.toFixed(4)}, {f.longitude.toFixed(4)}</td>
              <td className="text-right"><button aria-label={`Delete ${f.name}`} onClick={() => del(f.id)} className="p-1 text-muted hover:text-rose"><Trash2 className="h-4 w-4" /></button></td></tr>))}</tbody></table></div>}
      </Panel>
    </div>
  );
}
