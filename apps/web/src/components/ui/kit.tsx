"use client";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api";
import type { Provenance } from "@/lib/types";

export type DataClass = "observed" | "historical" | "predicted" | "simulated" | "demo";
const TAG: Record<DataClass, { label: string; cls: string; title: string }> = {
  observed: { label: "Observed", cls: "border-emerald/50 text-emerald", title: "Recent satellite or reanalysis observation" },
  historical: { label: "Historical", cls: "border-cyan/50 text-cyan", title: "Past observations or long-term climatology" },
  predicted: { label: "Predicted", cls: "border-violet-400/50 text-violet-300", title: "Output of an evaluated model" },
  simulated: { label: "Simulated", cls: "border-amber/60 text-amber", title: "Hypothetical scenario built on your assumptions" },
  demo: { label: "Demo data", cls: "border-rose/60 text-rose", title: "Illustrative values, not real data" },
};

export function DataTag({ kind }: { kind: DataClass }) {
  const t = TAG[kind];
  return <span title={t.title} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${t.cls}`}>{t.label}</span>;
}

export function Panel({ title, tag, actions, children, className = "" }: { title?: ReactNode; tag?: DataClass; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{title}</h2>{tag && <DataTag kind={tag} />}</div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="skeleton w-full" style={{ height: h }} aria-busy="true" aria-label="Loading" />;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = error as ApiError;
  const title = e?.status === 402 ? "Not included in your plan" : e?.status === 403 ? "You don't have access to this" : e?.status === 503 ? "Data source unavailable" : "Couldn't load this";
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose/30 bg-rose/5 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
      <div className="flex-1"><p className="font-semibold">{title}</p><p className="text-muted">{e?.message ?? String(error)}</p></div>
      {onRetry && e?.status !== 402 && e?.status !== 403 && <button className="btn btn-ghost !py-1 !text-xs" onClick={onRetry}><RefreshCw className="h-3 w-3" />Retry</button>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line p-6 text-sm">
      <p className="font-semibold">{title}</p>
      {children && <div className="text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function ProvenanceNote({ p }: { p: Provenance | Provenance[] | null | undefined }) {
  if (!p) return null;
  const list = Array.isArray(p) ? p : [p];
  return (
    <div className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-muted">
      {list.map((x, i) => (
        <p key={i} className="flex gap-1.5"><Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span><span className="text-ink">{x.provider ?? x.source_key}</span>{x.product && <>, {x.product}</>}
            {x.spatial_resolution && <>. Resolution {x.spatial_resolution}</>}{x.period && <>. Period {x.period}</>}
            {x.processed_at && <>. Retrieved {new Date(x.processed_at).toLocaleString()}</>}{x.status && <>. Status: {x.status.replace("_", " ")}</>}.
            {x.limitation && <> {x.limitation}</>}</span></p>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="panel p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="tabular mt-1 font-display text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-muted">{children}</label>;
}
