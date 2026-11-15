"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Satellite, X, Sparkles, Shield, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-store";

const NAV = [
  { href: "/platform", label: "Platform" },
  { href: "/industries", label: "Industries" },
  { href: "/agrisphere", label: "AgriSphere" },
  { href: "/experience", label: "Explore" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-cyan/40 bg-gradient-to-br from-cyan/20 to-emerald/20 shadow-[0_0_15px_rgba(34,211,238,0.25)] transition-transform duration-300 group-hover:scale-105">
        <Satellite className="h-4.5 w-4.5 text-cyan transition-transform duration-300 group-hover:rotate-12" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald radar-ring" />
      </span>
      <span className="flex items-center gap-1.5 text-snow">
        AgriIntel <span className="rounded-md border border-cyan/30 bg-cyan/10 px-1.5 py-0.5 text-[11px] font-mono font-medium text-cyan">LK</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const signedIn = useAuth((s) => !!s.accessToken);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 py-3 sm:px-6">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full border border-cyan/20 bg-abyss/75 px-5 backdrop-blur-xl shadow-[0_12px_32px_-4px_rgba(0,0,0,0.7),0_0_20px_-2px_rgba(34,211,238,0.15)]">
        <Logo />

        <nav className="hidden items-center gap-1 rounded-full border border-line/40 bg-panel/40 px-3 py-1 text-sm md:flex" aria-label="Main">
          {NAV.map((n) => {
            const active = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-cyan/15 text-cyan shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                    : "text-muted hover:text-snow hover:bg-panel-2/60"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {signedIn ? (
            <Link href="/app" className="btn btn-primary !py-2 !px-4 !text-xs shadow-md">
              <span>Open Console</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link href="/contact?kind=demo" className="btn btn-primary !py-2 !px-4 !text-xs shadow-md">
              <span>Request Demo</span>
              <Sparkles className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <button
          className="rounded-full p-2 text-muted hover:bg-panel md:hidden"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5 text-snow" /> : <Menu className="h-5 w-5 text-snow" />}
        </button>
      </div>

      {open && (
        <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-cyan/20 bg-abyss/95 p-5 backdrop-blur-2xl shadow-2xl md:hidden">
          <nav className="flex flex-col gap-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                  path === n.href ? "bg-cyan/15 text-cyan" : "text-muted hover:text-snow"
                }`}
              >
                {n.label}
              </Link>
            ))}
            {signedIn && (
              <div className="mt-3 border-t border-line/60 pt-3">
                <Link
                  href="/app"
                  onClick={() => setOpen(false)}
                  className="btn btn-primary w-full !py-2.5 text-xs"
                >
                  Open Console
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-line/60 bg-gradient-to-b from-navy/60 to-abyss py-16 text-snow">
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-cyan/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 top-0 h-96 w-96 rounded-full bg-emerald/10 blur-[120px]" />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            Satellite intelligence for agricultural decision support across Sri Lanka. Calibrated with NASA Langley Research Center POWER Project data, GPM IMERG precipitation, and Sentinel-2 multispectral observations.
          </p>
          <div className="mt-6 flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5 rounded-full border border-line/60 bg-panel px-3 py-1 font-mono">
              <Shield className="h-3.5 w-3.5 text-emerald" />
              RLS Multi-Tenant
            </span>
            <span className="font-mono">v1.2.0-LEO</span>
          </div>
        </div>

        <div className="text-sm">
          <p className="mb-4 font-display font-semibold tracking-wide text-cyan uppercase text-xs">Intelligence</p>
          <div className="space-y-2.5">
            {NAV.slice(0, 3).map((n) => (
              <Link key={n.href} href={n.href} className="block text-muted transition-colors hover:text-snow">
                {n.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="text-sm">
          <p className="mb-4 font-display font-semibold tracking-wide text-emerald uppercase text-xs">Platform</p>
          <div className="space-y-2.5">
            {NAV.slice(3).map((n) => (
              <Link key={n.href} href={n.href} className="block text-muted transition-colors hover:text-snow">
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mx-auto mt-12 max-w-7xl border-t border-line/40 px-5 pt-8 text-xs text-muted/70 flex flex-wrap items-center justify-between gap-4">
        <p>© 2026 AgriIntel Sri Lanka. Risk indicators are algorithmic decision-support estimates.</p>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald radar-ring" />
          <span className="font-mono text-emerald">ALL TELEMETRY SERVICES OPERATIONAL</span>
        </div>
      </div>
    </footer>
  );
}
