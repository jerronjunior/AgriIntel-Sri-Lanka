"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { DataTag, ErrorState, Label, Panel } from "@/components/ui/kit";
import { api } from "@/lib/api";
import { fmt, lkr, useOrgQuery } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-store";

const COSTS = ["seed", "fertilizer", "labor", "irrigation", "transport", "other"] as const;
type Row = { crop: string; area_ha: number; yield_t_per_ha: number; price_lkr_per_kg: number; costs_per_ha: Record<string, number> };
type Res = { crop: string; rank: number; production_kg: number; revenue_lkr: number; total_cost_lkr: number; net_profit_lkr: number; roi_pct: number | null; profit_per_acre_lkr: number; breakeven_price_lkr_per_kg: number | null; breakeven_yield_t_per_ha: number | null };
const blank = (crop: string): Row => ({ crop, area_ha: 1, yield_t_per_ha: 0, price_lkr_per_kg: 0, costs_per_ha: Object.fromEntries(COSTS.map((c) => [c, 0])) });

export default function Profitability() {
  const orgId = useAuth((s) => s.orgId);
  const qc = useQueryClient();
  const crops = useQuery({ queryKey: ["crops"], queryFn: () => api<{ items: { key: string; name: string }[] }>("/crops", { org: false }) });
  const saved = useOrgQuery<{ items: { id: string; name: string; created_at: string; assumptions: { scenarios: Row[] } }[] }>(["profit"], "/profitability/scenarios");
  const [rows, setRows] = useState<Row[]>([blank("maize"), blank("chili")]);
  const [name, setName] = useState("");
  const calc = useMutation({ mutationFn: (save: boolean) => api<{ results: Res[]; id?: string }>("/profitability/calculate", { body: { scenarios: rows, save, name: name || undefined } }),
    onSuccess: (_, save) => save && qc.invalidateQueries({ queryKey: [orgId, "profit"] }) });
  const nameOf = (k: string) => crops.data?.items.find((c) => c.key === k)?.name ?? k;
  const upd = (i: number, p: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const num = (v: string) => (v === "" ? 0 : parseFloat(v));
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div><h1 className="text-3xl font-semibold">Profitability</h1><p className="mt-1 text-muted">Enter your own yields, prices and per-hectare costs. Results update the ranking by net profit.</p></div>
      <Panel title="Assumptions" actions={<button className="btn btn-ghost !py-1.5 text-sm" onClick={() => setRows([...rows, blank(crops.data?.items[0]?.key ?? "paddy")])} disabled={rows.length >= 10}><Plus className="h-4 w-4" />Add crop</button>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="text-left text-muted"><th className="pb-2">Crop</th><th>Area ha</th><th>Yield t/ha</th><th>Price LKR/kg</th>{COSTS.map((c) => <th key={c} className="capitalize">{c} /ha</th>)}<th /></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}>
              <td className="py-1 pr-2"><select aria-label="Crop" className="field !py-1.5" value={r.crop} onChange={(e) => upd(i, { crop: e.target.value })}>{crops.data?.items.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></td>
              {(["area_ha", "yield_t_per_ha", "price_lkr_per_kg"] as const).map((k) => <td key={k} className="pr-2"><input aria-label={k} type="number" min={0} step="any" className="field tabular !py-1.5" value={r[k]} onChange={(e) => upd(i, { [k]: num(e.target.value) })} /></td>)}
              {COSTS.map((c) => <td key={c} className="pr-2"><input aria-label={`${c} cost`} type="number" min={0} step={1000} className="field tabular !py-1.5" value={r.costs_per_ha[c]} onChange={(e) => upd(i, { costs_per_ha: { ...r.costs_per_ha, [c]: num(e.target.value) } })} /></td>)}
              <td><button aria-label="Remove" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-2 text-muted hover:text-rose disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td>
            </tr>))}</tbody></table></div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <button className="btn btn-primary" onClick={() => calc.mutate(false)} disabled={calc.isPending}>Calculate</button>
          <div className="w-64"><Label htmlFor="sn">Scenario name</Label><input id="sn" className="field" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <button className="btn btn-ghost" onClick={() => calc.mutate(true)} disabled={calc.isPending || !name}>Save scenario</button>
          {calc.data?.id && <span className="text-sm text-emerald">Saved</span>}
        </div>
        {calc.isError && <div className="mt-3"><ErrorState error={calc.error} /></div>}
      </Panel>
      {calc.data && (
        <Panel title="Results by net profit" tag="simulated">
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm">
            <thead><tr className="text-left text-muted"><th className="pb-2">Rank</th><th>Crop</th><th>Production</th><th>Revenue</th><th>Total cost</th><th>Net profit</th><th>ROI</th><th>Profit per acre</th><th>Break-even price</th><th>Break-even yield</th></tr></thead>
            <tbody>{calc.data.results.map((r) => (
              <tr key={r.crop + r.rank} className="tabular border-t border-line">
                <td className="py-2">{r.rank}</td><td className="font-medium">{nameOf(r.crop)}</td><td>{fmt(r.production_kg)} kg</td><td>{lkr(r.revenue_lkr)}</td><td>{lkr(r.total_cost_lkr)}</td>
                <td className={r.net_profit_lkr < 0 ? "text-rose" : "text-emerald"}>{lkr(r.net_profit_lkr)}</td><td>{r.roi_pct == null ? "—" : `${fmt(r.roi_pct, 1)}%`}</td>
                <td>{lkr(r.profit_per_acre_lkr)}</td><td>{r.breakeven_price_lkr_per_kg == null ? "—" : `LKR ${fmt(r.breakeven_price_lkr_per_kg, 2)}/kg`}</td><td>{r.breakeven_yield_t_per_ha == null ? "—" : `${fmt(r.breakeven_yield_t_per_ha, 2)} t/ha`}</td>
              </tr>))}</tbody></table></div>
        </Panel>)}
      <Panel title="Saved scenarios">
        {!saved.data?.items.length ? <p className="text-sm text-muted">Name and save a calculation to keep its assumptions.</p> :
          <ul className="divide-y divide-line">{saved.data.items.map((s) => <li key={s.id} className="flex justify-between py-2 text-sm"><button className="hover:text-cyan" onClick={() => setRows(s.assumptions.scenarios)}>{s.name}</button><span className="text-xs text-muted">{new Date(s.created_at).toLocaleString()}</span></li>)}</ul>}
      </Panel>
      <p className="flex items-center gap-2 text-xs text-muted"><DataTag kind="simulated" /> results are calculations on your assumptions, not observations.</p>
    </div>
  );
}
