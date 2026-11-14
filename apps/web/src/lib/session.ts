"use client";
import { api } from "./api";
import { useAuth } from "./auth-store";
import type { Me } from "./types";

/** Store tokens, pick the organization and return the role-based landing route. */
export async function startSession(access: string, refresh: string, preferredOrg?: string): Promise<string> {
  const s = useAuth.getState();
  s.setTokens(access, refresh);
  const me = await api<Me>("/auth/me", { org: false });
  const m = me.memberships.find((x) => x.org_id === preferredOrg) ?? me.memberships[0];
  s.setOrg(m?.org_id ?? null);
  if (!m) return me.is_superadmin ? "/app/admin" : "/app";
  const landing: Record<string, string> = { insurance_analyst: "/app/risk", banking_analyst: "/app/risk", government_analyst: "/app/climate" };
  return landing[m.role] ?? "/app";
}
