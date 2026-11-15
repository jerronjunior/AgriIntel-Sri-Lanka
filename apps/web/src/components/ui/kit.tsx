"use client";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api";
import type { Provenance } from "@/lib/types";

export type DataClass = "observed" | "historical" | "predicted" | "simulated" | "demo";
const TAG: Record<DataClass, { label: string; cls: string; dot: string; title: string }> = {
  observed: {
    label: "Observed",
    cls: "border-emerald/40 bg-emerald/10 text-emerald shadow-[0_0_12px_rgba(34,197,94,0.25)]",
    dot: "bg-emerald",
    title: "Recent satellite or reanalysis observation",
  },
  historical: {
    label: "Historical",
    cls: "border-cyan/40 bg-cyan/10 text-cyan shadow-[0_0_12px_rgba(210,248,67,0.25)]",
    dot: "bg-cyan",
    title: "Past observations or long-term climatology",
  },
  predicted: {
    label: "Predicted",
    cls: "border-emerald/40 bg-emerald/10 text-emerald shadow-[0_0_12px_rgba(34,197,94,0.2)]",
    dot: "bg-emerald",
    title: "Output of an evaluated model",
  },
  simulated: {
    label: "Simulated",
    cls: "border-amber/50 bg-amber/10 text-amber shadow-[0_0_12px_rgba(245,158,11,0.2)]",
    dot: "bg-amber",
    title: "Hypothetical scenario built on your assumptions",
  },
  demo: {
    label: "Demo data",
    cls: "border-rose/50 bg-rose/10 text-rose shadow-[0_0_12px_rgba(251,113,133,0.2)]",
    dot: "bg-rose",
    title: "Illustrative values, not real data",
  },
};

export function DataTag({ kind }: { kind: DataClass }) {
  const t = TAG[kind];
  return (
    <span
      title={t.title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md ${t.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot} ${kind === "observed" ? "radar-ring" : ""}`} />
      {t.label}
    </span>
  );
}

export function Panel({
  title,
  tag,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  tag?: DataClass;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel card-3d p-6 ${className}`}>
      {(title || actions) && (
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {tag && <DataTag kind={tag} />}
          </div>
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
  const title =
    e?.status === 402
      ? "Not included in your plan"
      : e?.status === 403
      ? "You don't have access to this"
      : e?.status === 503
      ? "Data source unavailable"
      : "Couldn't load this";
  return (
    <div
      role="alert"
      className="glass flex items-start gap-3 rounded-2xl border border-rose/30 bg-rose/10 p-5 text-sm shadow-[0_8px_30px_rgba(251,113,133,0.15)]"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
      <div className="flex-1">
        <p className="font-semibold text-rose-200">{title}</p>
        <p className="text-muted">{e?.message ?? String(error)}</p>
      </div>
      {onRetry && e?.status !== 402 && e?.status !== 403 && (
        <button className="btn btn-ghost !py-1 !text-xs" onClick={onRetry}>
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-cyan/25 bg-panel/30 p-7 text-sm backdrop-blur-md">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function ProvenanceNote({ p }: { p: Provenance | Provenance[] | null | undefined }) {
  if (!p) return null;
  const list = Array.isArray(p) ? p : [p];
  return (
    <div className="mt-5 space-y-1.5 border-t border-line/60 pt-3.5 text-xs text-muted">
      {list.map((x, i) => (
        <p key={i} className="flex gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan/70" />
          <span>
            <span className="font-medium text-ink">{x.provider ?? x.source_key}</span>
            {x.product && <>, {x.product}</>}
            {x.spatial_resolution && <>. Resolution {x.spatial_resolution}</>}
            {x.period && <>. Period {x.period}</>}
            {x.processed_at && <>. Retrieved {new Date(x.processed_at).toLocaleString()}</>}
            {x.status && <>. Status: {x.status.replace("_", " ")}</>}.
            {x.limitation && <> {x.limitation}</>}
          </span>
        </p>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="panel card-3d group relative overflow-hidden p-5">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-cyan/10 blur-xl transition-all duration-300 group-hover:scale-150 group-hover:bg-cyan/20" />
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular mt-2 font-display text-3xl font-bold tracking-tight text-ink drop-shadow-[0_2px_10px_rgba(34,211,238,0.2)]">
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs text-muted/80">{sub}</p>}
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </label>
  );
}
