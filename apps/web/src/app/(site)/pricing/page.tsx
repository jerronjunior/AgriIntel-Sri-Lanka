"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, Minus } from "lucide-react";
import { api } from "@/lib/api";
import { ErrorState, Skeleton } from "@/components/ui/kit";
import type { Plan } from "@/lib/types";

const lim = (v: number | null | undefined) => (v === null || v === undefined ? "Unlimited" : v.toLocaleString());

export default function Pricing() {
  const q = useQuery({ queryKey: ["plans"], queryFn: () => api<{ items: Plan[]; features: Record<string, string>; pricing_note: string }>("/subscriptions/plans", { auth: false, org: false }) });
  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <h1 className="text-5xl font-semibold">Plans for every kind of agricultural risk</h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">Every plan starts with a 14-day trial. Prices are set per organization; ask us for a quote or start a trial today.</p>
      {q.isLoading && <div className="mt-10"><Skeleton h={320} /></div>}
      {q.isError && <div className="mt-10"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>}
      {q.data && (
        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-1/4 p-3 text-left font-normal text-muted">Feature</th>
                {q.data.items.map((p) => (
                  <th key={p.key} className="p-3 text-left align-top">
                    <p className="font-display text-xl">{p.name}</p>
                    <p className="font-normal text-muted">{p.audience}</p>
                    <p className="mt-3 font-normal">{p.price_amount != null ? `${p.price_currency} ${p.price_amount.toLocaleString()} / ${p.billing_period}` : "Pricing on request"}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(q.data.features).map(([k, label]) => (
                <tr key={k} className="border-t border-line">
                  <td className="p-3">{label}</td>
                  {q.data.items.map((p) => <td key={p.key} className="p-3">{p.features.includes(k) ? <Check className="h-4 w-4 text-emerald" aria-label="Included" /> : <Minus className="h-4 w-4 text-muted/50" aria-label="Not included" />}</td>)}
                </tr>
              ))}
              {[["max_farms", "Farms"], ["max_users", "Users"], ["max_simulations_per_month", "Simulations per month"]].map(([k, l]) => (
                <tr key={k} className="border-t border-line"><td className="p-3">{l}</td>{q.data.items.map((p) => <td key={p.key} className="tabular p-3">{lim(p.limits[k])}</td>)}</tr>
              ))}
              <tr className="border-t border-line">
                <td />
                {q.data.items.map((p) => (
                  <td key={p.key} className="space-y-2 p-3">
                    <Link href={`/register?plan=${p.key}`} className="btn btn-primary w-full !py-2">Start trial</Link>
                    <Link href={`/contact?kind=subscription&plan=${p.key}`} className="btn btn-ghost w-full !py-2">Ask for a quote</Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-6 text-xs text-muted">{q.data.pricing_note}</p>
        </div>
      )}
    </div>
  );
}
