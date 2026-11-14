"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Satellite, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-store";

const NAV = [
  { href: "/platform", label: "Platform" }, { href: "/industries", label: "Industries" },
  { href: "/pricing", label: "Pricing" }, { href: "/about", label: "About" }, { href: "/contact", label: "Contact" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold">
      <span className="grid h-8 w-8 place-items-center rounded-full border border-emerald/50 bg-emerald/10"><Satellite className="h-4 w-4 text-emerald" /></span>
      AgriIntel <span className="font-normal text-muted">Sri Lanka</span>
    </Link>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const signedIn = useAuth((s) => !!s.accessToken);
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-abyss/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Main">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={path === n.href ? "text-ink" : "text-muted hover:text-ink"}>{n.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {signedIn ? <Link href="/app" className="btn btn-primary !py-2">Open dashboard</Link> : <>
            <Link href="/login" className="text-sm text-muted hover:text-ink">Sign in</Link>
            <Link href="/contact?kind=demo" className="btn btn-primary !py-2">Request a demo</Link></>}
        </div>
        <button className="md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <nav className="border-t border-line bg-abyss px-5 py-4 md:hidden">
          {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block py-2">{n.label}</Link>)}
          <Link href={signedIn ? "/app" : "/login"} className="mt-2 block py-2 text-emerald">{signedIn ? "Open dashboard" : "Sign in"}</Link>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-navy">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-md text-sm text-muted">Satellite intelligence for agricultural decisions in Sri Lanka. Climate data from the NASA Langley Research Center POWER Project. Sentinel-2 imagery, when enabled, is provided by the EU Copernicus programme.</p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold">Product</p>
          {NAV.slice(0, 3).map((n) => <Link key={n.href} href={n.href} className="block py-1 text-muted hover:text-ink">{n.label}</Link>)}
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold">Company</p>
          {NAV.slice(3).map((n) => <Link key={n.href} href={n.href} className="block py-1 text-muted hover:text-ink">{n.label}</Link>)}
          <Link href="/login" className="block py-1 text-muted hover:text-ink">Sign in</Link>
        </div>
      </div>
      <p className="mx-auto max-w-7xl px-5 pb-8 text-xs text-muted">Risk scores and recommendations are decision-support estimates. They are not underwriting, credit or agronomic guarantees.</p>
    </footer>
  );
}
