"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, ChevronsLeft, ChevronsRight, CloudRain, Droplets, Gauge, LineChart, LogOut, Map, Moon, Search, Settings, ShieldAlert,
  SlidersHorizontal, Sprout, Sun, Tractor, TrendingUp, Crown, Satellite,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { useDistricts, useMe } from "@/lib/hooks";

const NAV = [
  { href: "/app", label: "Overview", icon: Gauge },
  { href: "/app/map", label: "Intelligence map", icon: Map, feature: "map" },
  { href: "/app/simulator", label: "Decision Simulator", icon: SlidersHorizontal, feature: "simulator" },
  { href: "/app/climate", label: "Climate", icon: CloudRain, feature: "climate" },
  { href: "/app/soil", label: "Soil and water", icon: Droplets, feature: "soil_water" },
  { href: "/app/crops", label: "Crop suitability", icon: Sprout, feature: "crop_suitability" },
  { href: "/app/profitability", label: "Profitability", icon: TrendingUp, feature: "profitability" },
  { href: "/app/market", label: "Market", icon: LineChart, feature: "market" },
  { href: "/app/risk", label: "Risk", icon: ShieldAlert, feature: "risk" },
  { href: "/app/farms", label: "Farms", icon: Tractor },
  { href: "/app/settings", label: "Organization", icon: Settings },
];

type Notif = { items: { id: string; title: string; body: string; severity: string; read: boolean; created_at: string }[]; unread: number; announcements: { title: string; body: string }[] };

function Notifications() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const orgId = useAuth((s) => s.orgId);
  const q = useQuery({ queryKey: [orgId, "notifications"], queryFn: () => api<Notif>("/notifications"), enabled: !!orgId, refetchInterval: 120_000 });
  const read = async (id: string) => { await api(`/notifications/${id}/read`, { method: "POST" }); qc.invalidateQueries({ queryKey: [orgId, "notifications"] }); };
  return (
    <div className="relative">
      <button aria-label={`Notifications, ${q.data?.unread ?? 0} unread`} onClick={() => setOpen(!open)} className="relative rounded-full p-2 hover:bg-panel-2">
        <Bell className="h-5 w-5" />{!!q.data?.unread && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald" />}
      </button>
      {open && (
        <div className="panel absolute right-0 z-50 mt-2 w-80 p-3 shadow-2xl">
          {q.data?.announcements.map((a) => <div key={a.title} className="mb-2 rounded-lg bg-cyan/10 p-2 text-sm"><p className="font-semibold">{a.title}</p><p className="text-muted">{a.body}</p></div>)}
          {!q.data?.items.length && <p className="p-2 text-sm text-muted">No alerts. Rainfall-deficit alerts appear here when automation is running.</p>}
          {q.data?.items.map((n) => (
            <button key={n.id} onClick={() => read(n.id)} className={`block w-full rounded-lg p-2 text-left text-sm hover:bg-panel-2 ${n.read ? "opacity-60" : ""}`}>
              <p className="font-semibold">{n.title}</p><p className="text-muted">{n.body}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const d = useDistricts();
  const [v, setV] = useState("");
  return (
    <form className="relative hidden md:block" onSubmit={(e) => { e.preventDefault(); const m = d.data?.items.find((x) => x.name.toLowerCase().startsWith(v.toLowerCase())); if (m) router.push(`/app/map?district=${encodeURIComponent(m.name)}`); }}>
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
      <input list="district-list" value={v} onChange={(e) => setV(e.target.value)} placeholder="Jump to a district" aria-label="Search districts" className="field !w-64 !rounded-full !py-1.5 pl-9" />
      <datalist id="district-list">{d.data?.items.map((x) => <option key={x.name} value={x.name} />)}</datalist>
    </form>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { accessToken, orgId, setOrg, logout } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const me = useMe();
  const qc = useQueryClient();

  useEffect(() => { setHydrated(true); try { const t = localStorage.getItem("agriintel-theme"); if (t === "light") setTheme("light"); } catch { /* storage blocked */ } }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("agriintel-theme", theme); } catch { /* ignore */ } return () => { document.documentElement.dataset.theme = "dark"; }; }, [theme]);
  useEffect(() => { if (hydrated && !accessToken) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [hydrated, accessToken, router, path]);
  useEffect(() => { if (me.data && !orgId && me.data.memberships[0]) setOrg(me.data.memberships[0].org_id); }, [me.data, orgId, setOrg]);

  if (!hydrated || !accessToken) return null;
  const membership = me.data?.memberships.find((m) => m.org_id === orgId);
  const features = new Set(membership?.features ?? []);

  return (
    <div className="flex min-h-screen">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-panel transition-[width] md:flex ${collapsed ? "w-16" : "w-60"}`}>
        <Link href="/" className="flex h-16 items-center gap-2 px-4 font-display font-semibold">
          <Satellite className="h-5 w-5 shrink-0 text-emerald" />{!collapsed && "AgriIntel"}
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2" aria-label="Dashboard">
          {NAV.map((n) => {
            const active = n.href === "/app" ? path === "/app" : path.startsWith(n.href);
            const locked = n.feature && membership && !features.has(n.feature);
            return (
              <Link key={n.href} href={n.href} title={collapsed ? n.label : locked ? "Not in your plan" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active ? "bg-emerald/12 text-ink" : "text-muted hover:bg-panel-2 hover:text-ink"} ${locked ? "opacity-45" : ""}`}>
                <n.icon className={`h-4 w-4 shrink-0 ${active ? "text-emerald" : ""}`} />{!collapsed && n.label}
              </Link>
            );
          })}
          {me.data?.is_superadmin && (
            <Link href="/app/admin" className={`mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${path.startsWith("/app/admin") ? "bg-emerald/12" : "text-muted hover:bg-panel-2"}`}>
              <Crown className="h-4 w-4 text-amber" />{!collapsed && "Platform admin"}
            </Link>)}
        </nav>
        {!collapsed && membership && (
          <div className="m-3 rounded-lg border border-line p-3 text-xs">
            <p className="text-muted">Plan</p><p className="font-semibold capitalize">{membership.plan_key} intelligence</p>
            <p className={membership.subscription_status === "trial" ? "text-amber" : "text-emerald"}>{membership.subscription_status}</p>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="m-2 flex items-center justify-center rounded-lg p-2 text-muted hover:bg-panel-2">
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur md:px-6">
          <select aria-label="Organization" className="field !w-auto !py-1.5" value={orgId ?? ""} onChange={(e) => { setOrg(e.target.value); qc.invalidateQueries(); }}>
            {me.data?.memberships.map((m) => <option key={m.org_id} value={m.org_id}>{m.org_name}</option>)}
            {!me.data?.memberships.length && <option value="">No organization</option>}
          </select>
          <span className="hidden text-xs capitalize text-muted lg:inline">{membership?.role.replace("_", " ")}</span>
          <div className="flex-1" />
          <GlobalSearch />
          <button aria-label="Toggle light or dark mode" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="rounded-full p-2 hover:bg-panel-2">{theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
          <Notifications />
          <div className="hidden text-right text-sm sm:block"><p className="font-medium leading-tight">{me.data?.full_name}</p><p className="text-xs text-muted">{me.data?.email}</p></div>
          <button aria-label="Sign out" onClick={() => { logout(); qc.clear(); router.push("/login"); }} className="rounded-full p-2 hover:bg-panel-2"><LogOut className="h-5 w-5" /></button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden" aria-label="Dashboard">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${path === n.href ? "bg-emerald/15" : "text-muted"}`}>{n.label}</Link>)}
        </nav>
        {me.data && !me.data.email_verified && <VerifyBanner />}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function VerifyBanner() {
  const [sent, setSent] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber/30 bg-amber/10 px-6 py-2 text-sm">
      Verify your email to keep access after the trial.
      <button disabled={sent} onClick={async () => { await api("/auth/resend-verification", { method: "POST", org: false }); setSent(true); }} className="underline disabled:no-underline disabled:opacity-60">{sent ? "Link sent" : "Resend the link"}</button>
    </div>
  );
}
