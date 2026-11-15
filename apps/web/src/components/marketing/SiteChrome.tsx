"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sprout, X, Sparkles, Shield, ArrowUpRight, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-store";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/app/farms", label: "Our Farms" },
  { href: "/app/climate", label: "Engines" },
  { href: "/platform", label: "Sustainability" },
  { href: "/app/simulator", label: "Simulator" },
];

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight">
      <span className="relative grid h-9 w-9 place-items-center rounded-full border border-cyan/50 bg-gradient-to-br from-cyan/30 to-emerald/20 shadow-[0_0_18px_rgba(22,143,196,0.28)] transition-transform duration-300 group-hover:scale-110">
        <Sprout className="h-4.5 w-4.5 text-cyan transition-transform duration-300 group-hover:rotate-12" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan radar-ring" />
      </span>
      <span className="flex items-center gap-1.5 text-snow font-black uppercase tracking-wider text-base">
        AgriIntel
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
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full border border-line/70 bg-panel/90 px-4 sm:px-6 backdrop-blur-2xl shadow-[0_16px_40px_rgba(35,91,128,0.18),0_0_25px_rgba(22,143,196,0.12)]">
        <Logo />

        <nav className="hidden items-center gap-1 rounded-full border border-line/60 bg-panel/50 p-1 text-sm md:flex" aria-label="Main">
          {NAV.map((n) => {
            const active = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? "bg-cyan text-night shadow-[0_0_15px_rgba(22,143,196,0.3)]"
                    : "text-muted hover:text-snow hover:bg-panel-2/70"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {!signedIn && (
            <Link href="/login" className="text-xs font-bold text-snow/90 hover:text-cyan transition-colors px-2">
              Sign in
            </Link>
          )}
          {signedIn ? (
            <Link href="/app" className="btn-farmer !py-1 !pl-3.5 !pr-1.5 !text-xs">
              <span>Console</span>
              <span className="btn-farmer-circle !h-6 !w-6">
                <ArrowUpRight className="h-3.5 w-3.5 text-snow" />
              </span>
            </Link>
          ) : (
            <Link href="/contact" className="btn-farmer !py-1 !pl-3.5 !pr-1.5 !text-xs">
              <span>Contact Us</span>
              <span className="btn-farmer-circle !h-6 !w-6">
                <ArrowRight className="h-3.5 w-3.5 text-snow" />
              </span>
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
        <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-line/70 bg-panel/95 p-5 backdrop-blur-2xl shadow-2xl md:hidden">
          <nav className="flex flex-col gap-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  path === n.href ? "bg-cyan text-night" : "text-muted hover:text-snow"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-3 border-t border-line/60 pt-3 flex flex-col gap-2">
              {!signedIn && (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-center text-snow hover:bg-panel"
                >
                  Sign in
                </Link>
              )}
              <Link
                href={signedIn ? "/app" : "/contact"}
                onClick={() => setOpen(false)}
                className="btn btn-primary w-full !py-2.5 text-xs text-center justify-center"
              >
                {signedIn ? "Open Console" : "Contact Us"}
              </Link>
            </div>
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
