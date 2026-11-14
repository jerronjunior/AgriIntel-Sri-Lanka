import { Logo } from "@/components/marketing/SiteChrome";
import { Satellite, ShieldCheck, Zap, Radio, Globe } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-abyss text-snow md:grid md:grid-cols-[1.1fr_1.3fr]">
      {/* Background radial ambient lights */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-10 h-[600px] w-[600px] rounded-full bg-emerald/10 blur-[150px]" />
      <div className="pointer-events-none absolute right-1/3 top-1/3 h-[400px] w-[400px] rounded-full bg-violet/10 blur-[130px]" />

      {/* Left panel: Auth Form with 3D transmission card */}
      <div className="relative z-10 flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <header className="flex items-center justify-between">
          <Logo />
          <div className="hidden items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-3 py-1 text-xs font-semibold text-emerald sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald radar-ring" />
            Telemetry Uplink Online
          </div>
        </header>

        <main className="my-auto flex w-full max-w-md flex-col justify-center py-10">
          <div className="glass-transmission rounded-3xl p-8 sm:p-10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] border-t-white/20">
            {children}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald" />
            <span>End-to-End Enterprise Encryption</span>
          </div>
          <span>AgriIntel · Sri Lanka LEO Portal</span>
        </footer>
      </div>

      {/* Right panel: 3D Telemetry & Geospatial Mission Control Display */}
      <div
        aria-hidden
        className="relative hidden flex-col justify-between overflow-hidden border-l border-line/60 bg-gradient-to-br from-navy/90 via-abyss to-[#02050b] p-12 lg:flex"
      >
        {/* Perspective grid floor */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black,transparent)]" />

        {/* Ambient scanning laser bar */}
        <div className="pointer-events-none absolute -inset-x-20 top-1/4 h-[2px] bg-gradient-to-r from-transparent via-cyan to-transparent opacity-40 shadow-[0_0_20px_rgba(34,211,238,0.8)] animate-pulse" />

        {/* Top Telemetry Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan/40 bg-cyan/10 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              <Satellite className="h-5 w-5 text-cyan animate-pulse" />
            </span>
            <div>
              <p className="font-display text-sm font-bold tracking-wider text-snow uppercase">NASA Earth Observation Grid</p>
              <p className="text-xs text-cyan font-mono">LAT: 7.8731° N · LON: 80.7718° E · ALT: 705 KM</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-cyan/30 bg-panel px-3 py-1 text-xs font-mono text-cyan">
            <Radio className="h-3.5 w-3.5 text-cyan animate-ping" />
            LEO SYNC 24/7
          </div>
        </div>

        {/* Central 3D Holographic Island with Orbital Rings */}
        <div className="relative my-auto flex h-[460px] w-full items-center justify-center">
          {/* Concentric orbital telemetry rings */}
          <div className="absolute h-96 w-96 rounded-full border border-cyan/20 [animation:spin_40s_linear_infinite]" />
          <div className="absolute h-80 w-80 rounded-full border border-dashed border-emerald/25 [animation:spin_25s_linear_infinite_reverse]" />
          <div className="absolute h-64 w-64 rounded-full border border-cyan/30 shadow-[0_0_30px_rgba(34,211,238,0.15)]" />

          {/* Glowing Sri Lanka Map Vector */}
          <div className="relative flex items-center justify-center filter drop-shadow-[0_0_35px_rgba(16,185,129,0.4)]">
            <img
              src="/geo/sri-lanka.svg"
              alt="Sri Lanka Satellite Topology"
              className="h-80 w-auto object-contain transition-transform duration-700 hover:scale-105"
            />
          </div>

          {/* Floating 3D Telemetry Nodes */}
          <div className="glass-transmission card-3d absolute -left-2 top-12 flex items-center gap-3 rounded-2xl p-3.5 shadow-2xl border-emerald/30">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald/20 text-emerald">
              <Zap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">NASA POWER Sync</p>
              <p className="text-xs font-bold text-emerald">Active · 0.5° Resolution</p>
            </div>
          </div>

          <div className="glass-transmission card-3d absolute -right-2 bottom-14 flex items-center gap-3 rounded-2xl p-3.5 shadow-2xl border-cyan/30">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan/20 text-cyan">
              <Globe className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Island Climatology</p>
              <p className="text-xs font-bold text-cyan">25 Agronomic Districts</p>
            </div>
          </div>
        </div>

        {/* Bottom Mission Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-4 border-t border-line/60 pt-6">
          <div className="glass rounded-2xl p-3 text-center border-line/40">
            <p className="text-[11px] text-muted uppercase font-semibold">Precipitation</p>
            <p className="mt-1 font-display text-lg font-bold text-cyan">GPM IMERG</p>
          </div>
          <div className="glass rounded-2xl p-3 text-center border-line/40">
            <p className="text-[11px] text-muted uppercase font-semibold">Soil Moisture</p>
            <p className="mt-1 font-display text-lg font-bold text-emerald">SMAP L4</p>
          </div>
          <div className="glass rounded-2xl p-3 text-center border-line/40">
            <p className="text-[11px] text-muted uppercase font-semibold">Security</p>
            <p className="mt-1 font-display text-lg font-bold text-violet">PostgreSQL RLS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
