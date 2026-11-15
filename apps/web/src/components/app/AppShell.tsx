"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, ChevronsLeft, ChevronsRight, CloudRain, Droplets, Gauge, LineChart, LogOut, Map, Moon, Search, Settings, ShieldAlert,
  SlidersHorizontal, Sprout, Sun, Tractor, TrendingUp, Crown, Satellite, Radio, Zap, MapPinned
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { useDistricts, useMe } from "@/lib/hooks";

const NAV = [
  { href: "/app", label: "Overview", icon: Gauge },
  { href: "/app/map", label: "Intelligence map", icon: Map, feature: "map" },
  { href: "/app/intelligence", label: "District intelligence", icon: MapPinned, feature: "map" },
  { href: "/app/simulator", label: "Decision Simulator", icon: SlidersHorizontal, feature: "simulator" },
  { href: "/app/climate", label: "Climate Engine (M1)", icon: CloudRain, feature: "climate" },
  { href: "/app/water", label: "Water Engine (M2)", icon: Droplets, feature: "soil_water" },
  { href: "/app/soil", label: "Soil Intelligence (M3)", icon: Droplets, feature: "soil_water" },
  { href: "/app/crops", label: "Crop Suitability (M4)", icon: Sprout, feature: "crop_suitability" },
  { href: "/app/yield", label: "Yield Forecasting (M5)", icon: TrendingUp, feature: "crop_suitability" },
  { href: "/app/profitability", label: "Profitability", icon: TrendingUp, feature: "profitability" },
  { href: "/app/market", label: "Market", icon: LineChart, feature: "market" },
  { href: "/app/risk", label: "Risk", icon: ShieldAlert, feature: "risk" },
  { href: "/app/farms", label: "Farms", icon: Tractor },
  { href: "/app/settings", label: "Organization", icon: Settings },
];

type Notif = {
  items: { id: string; title: string; body: string; severity: string; read: boolean; created_at: string }[];
  unread: number;
  announcements: { title: string; body: string }[];
};

function Notifications() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const orgId = useAuth((s) => s.orgId);
  const q = useQuery({
    queryKey: [orgId, "notifications"],
    queryFn: () => api<Notif>("/notifications"),
    enabled: !!orgId,
    refetchInterval: 120_000,
  });
  const read = async (id: string) => {
    await api(`/notifications/${id}/read`, { method: "POST" });
    qc.invalidateQueries({ queryKey: [orgId, "notifications"] });
  };

  return (
    <div className="relative">
      <button
        aria-label={`Notifications, ${q.data?.unread ?? 0} unread`}
        onClick={() => setOpen(!open)}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-line/60 bg-panel/60 backdrop-blur-md text-muted transition-all hover:border-cyan/40 hover:text-cyan hover:shadow-[0_0_15px_rgba(34,211,238,0.25)]"
      >
        <Bell className="h-4 w-4" />
        {!!q.data?.unread && (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald radar-ring" />
        )}
      </button>

      {open && (
        <div className="glass-transmission absolute right-0 z-50 mt-3 w-84 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-cyan/30">
          <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-snow">Telemetry Alerts</span>
            <span className="text-[11px] font-mono text-cyan">{q.data?.unread ?? 0} Unread</span>
          </div>

          {q.data?.announcements.map((a) => (
            <div key={a.title} className="mb-2 rounded-xl border border-cyan/30 bg-cyan/10 p-3 text-sm">
              <p className="font-semibold text-cyan">{a.title}</p>
              <p className="mt-1 text-xs text-muted">{a.body}</p>
            </div>
          ))}

          {!q.data?.items.length && (
            <p className="p-3 text-center text-xs text-muted">
              No active alerts. Automatic satellite telemetry notifications appear here.
            </p>
          )}

          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {q.data?.items.map((n) => (
              <button
                key={n.id}
                onClick={() => read(n.id)}
                className={`block w-full rounded-xl p-2.5 text-left text-xs transition-colors hover:bg-panel-2 ${
                  n.read ? "opacity-50" : "bg-panel/40 border border-line/40"
                }`}
              >
                <p className="font-semibold text-snow">{n.title}</p>
                <p className="mt-0.5 text-muted">{n.body}</p>
              </button>
            ))}
          </div>
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
    <form
      className="relative hidden md:block"
      onSubmit={(e) => {
        e.preventDefault();
        const m = d.data?.items.find((x) => x.name.toLowerCase().startsWith(v.toLowerCase()));
        if (m) router.push(`/app/map?district=${encodeURIComponent(m.name)}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-2.5 h-3.5 w-3.5 text-muted/70" />
      <input
        list="district-list"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Search 25 districts…"
        aria-label="Search districts"
        className="field !w-60 !rounded-full !py-1.5 !pl-9 !text-xs border-cyan/20 bg-abyss/60 backdrop-blur-md focus:!w-72"
      />
      <datalist id="district-list">
        {d.data?.items.map((x) => (
          <option key={x.name} value={x.name} />
        ))}
      </datalist>
    </form>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { accessToken, orgId, setOrg, logout } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const me = useMe();
  const qc = useQueryClient();

  useEffect(() => {
    setHydrated(true);
    try {
      const t = localStorage.getItem("agriintel-theme");
      if (t === "dark") setTheme("dark");
    } catch {
      /* storage blocked */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("agriintel-theme", theme);
    } catch {
      /* ignore */
    }
    return () => {
      document.documentElement.dataset.theme = "dark";
    };
  }, [theme]);

  useEffect(() => {
    if (hydrated && !accessToken) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [hydrated, accessToken, router, path]);

  useEffect(() => {
    if (me.data && !orgId && me.data.memberships[0]) setOrg(me.data.memberships[0].org_id);
  }, [me.data, orgId, setOrg]);

  if (!hydrated || !accessToken) return null;
  const membership = me.data?.memberships.find((m) => m.org_id === orgId);
  const features = new Set(membership?.features ?? []);

  return (
    <div className="relative flex min-h-screen bg-bg">
      {/* Ambient background illumination orbs */}
      <div className="pointer-events-none fixed -left-32 top-10 h-96 w-96 rounded-full bg-cyan/10 blur-[140px] z-0" />
      <div className="pointer-events-none fixed bottom-10 right-10 h-[480px] w-[480px] rounded-full bg-emerald/10 blur-[160px] z-0" />

      {/* 3D Glass Sidebar */}
      <aside
        className={`sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-line/60 bg-abyss/85 backdrop-blur-2xl transition-[width] duration-300 md:flex ${
          collapsed ? "w-18" : "w-64"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-line/40">
          <Link href="/" className="group flex items-center gap-2.5 font-display font-bold">
            <span className="relative grid h-8 w-8 place-items-center rounded-xl border border-cyan/40 bg-gradient-to-br from-cyan/20 to-emerald/20 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
              <Satellite className="h-4 w-4 text-cyan" />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald radar-ring" />
            </span>
            {!collapsed && (
              <span className="flex items-center gap-1 text-sm font-semibold text-snow">
                AgriIntel
              </span>
            )}
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
          {NAV.map((n) => {
            const active = n.href === "/app" ? path === "/app" : path.startsWith(n.href);
            const locked = n.feature && membership && !features.has(n.feature);
            return (
              <Link
                key={n.href}
                href={n.href}
                title={collapsed ? n.label : locked ? "Not in your plan" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-gradient-to-r from-cyan/20 to-emerald/15 text-snow shadow-[0_0_20px_rgba(34,211,238,0.2)] border border-cyan/35"
                    : "text-muted hover:bg-panel-2/60 hover:text-snow"
                } ${locked ? "opacity-45" : ""}`}
              >
                <n.icon
                  className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                    active ? "text-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" : "text-muted"
                  }`}
                />
                {!collapsed && <span>{n.label}</span>}
              </Link>
            );
          })}

          {me.data?.is_superadmin && (
            <Link
              href="/app/admin"
              className={`mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                path.startsWith("/app/admin")
                  ? "bg-amber/15 text-amber border border-amber/30"
                  : "text-muted hover:bg-panel-2/60"
              }`}
            >
              <Crown className="h-4 w-4 text-amber" />
              {!collapsed && <span>Platform Admin</span>}
            </Link>
          )}
        </nav>

        {!collapsed && membership && (
          <div className="glass-transmission m-3 rounded-2xl p-3.5 border-line/60">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Tier Status</span>
              <span
                className={`text-[11px] font-mono font-bold capitalize ${
                  membership.subscription_status === "trial" ? "text-amber" : "text-emerald"
                }`}
              >
                {membership.subscription_status}
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-snow capitalize">{membership.plan_key} Intelligence</p>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line/40 p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-snow"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
          {!collapsed && (
            <span className="flex items-center gap-1.5 px-2 text-[10px] font-mono text-emerald">
              <Radio className="h-3 w-3 animate-pulse" />
              LEO 24/7
            </span>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Floating Glass Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line/60 bg-abyss/80 px-4 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-2">
            <select
              aria-label="Organization"
              className="field !w-auto !py-1.5 !px-3 !text-xs font-semibold border-cyan/25 bg-panel"
              value={orgId ?? ""}
              onChange={(e) => {
                setOrg(e.target.value);
                qc.invalidateQueries();
              }}
            >
              {me.data?.memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {m.org_name}
                </option>
              ))}
              {!me.data?.memberships.length && <option value="">No organization</option>}
            </select>
            <span className="hidden rounded-full border border-line/60 bg-panel px-2.5 py-0.5 text-[11px] font-medium text-cyan capitalize lg:inline">
              {membership?.role.replace("_", " ")}
            </span>
          </div>

          <div className="flex-1" />
          <GlobalSearch />

          <button
            aria-label="Toggle light or dark mode"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line/60 bg-panel/60 text-muted transition-colors hover:border-cyan/40 hover:text-cyan"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <Notifications />

          <div className="hidden border-l border-line/60 pl-3 text-right text-xs sm:block">
            <p className="font-semibold text-snow leading-tight">{me.data?.full_name}</p>
            <p className="text-[11px] text-muted/80">{me.data?.email}</p>
          </div>

          <button
            aria-label="Sign out"
            onClick={() => {
              logout();
              qc.clear();
              router.push("/login");
            }}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line/60 bg-panel/60 text-muted transition-colors hover:border-rose/40 hover:text-rose hover:shadow-[0_0_12px_rgba(251,113,133,0.25)]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Mobile Navigation Strip */}
        <nav className="flex gap-1.5 overflow-x-auto border-b border-line/60 bg-abyss/90 px-3 py-2.5 md:hidden" aria-label="Dashboard">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                path === n.href
                  ? "bg-cyan/20 text-cyan border border-cyan/40"
                  : "bg-panel text-muted hover:text-snow"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {me.data && !me.data.email_verified && <VerifyBanner />}
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function VerifyBanner() {
  const [sent, setSent] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber/40 bg-amber/15 px-6 py-2.5 text-xs text-amber-200 backdrop-blur-md">
      <Zap className="h-4 w-4 text-amber shrink-0" />
      <span>Verify your email to preserve uninterrupted satellite telemetry access after your trial.</span>
      <button
        disabled={sent}
        onClick={async () => {
          await api("/auth/resend-verification", { method: "POST", org: false });
          setSent(true);
        }}
        className="font-semibold underline transition-opacity hover:opacity-80 disabled:no-underline disabled:opacity-60"
      >
        {sent ? "Verification dispatched" : "Resend verification link"}
      </button>
    </div>
  );
}
