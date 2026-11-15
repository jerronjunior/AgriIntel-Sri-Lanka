"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth-store";
import type { District, Me } from "./types";

const DEMO_USER: Me = {
  id: "demo-user-01",
  email: "user01@gmail.com",
  full_name: "Demo Farm Manager (user01)",
  is_superadmin: false,
  email_verified: true,
  memberships: [
    {
      org_id: "demo-org",
      org_name: "AgriIntel Demo Farm",
      industry: "agriculture",
      role: "farm_manager",
      plan_key: "enterprise",
      features: ["climate", "soil_water", "crop_suitability", "profitability", "market", "risk", "simulator", "map"],
      subscription_status: "active",
    },
  ],
};

export function useMe() {
  const token = useAuth((s) => s.accessToken);
  return useQuery({
    queryKey: ["me", token],
    queryFn: async () => {
      if (token === "demo-token") return DEMO_USER;
      try {
        return await api<Me>("/auth/me", { org: false });
      } catch {
        // Fallback to demo user if offline
        return DEMO_USER;
      }
    },
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useDistricts() {
  return useQuery({ queryKey: ["districts"], queryFn: () => api<{ items: District[] }>("/locations/districts", { auth: false, org: false }), staleTime: Infinity });
}

export function useOrgQuery<T>(key: unknown[], path: string, enabled = true) {
  const orgId = useAuth((s) => s.orgId);
  return useQuery({ queryKey: [orgId, ...key], queryFn: () => api<T>(path), enabled: !!orgId && enabled, retry: (n, e: unknown) => n < 1 && (e as { status?: number })?.status !== 402 && (e as { status?: number })?.status !== 403 });
}

export const fmt = (v: number | null | undefined, d = 0) => (v === null || v === undefined || Number.isNaN(v) ? "—" : v.toLocaleString("en-LK", { maximumFractionDigits: d, minimumFractionDigits: d }));
export const lkr = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `LKR ${fmt(v)}`);
