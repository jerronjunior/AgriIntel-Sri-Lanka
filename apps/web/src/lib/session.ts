"use client";
import { api } from "./api";
import { useAuth } from "./auth-store";
import type { Me } from "./types";

/** Store tokens, pick the organization and return the role-based landing route. */
export async function startSession(access: string, refresh: string, preferredOrg?: string): Promise<string> {
  const s = useAuth.getState();
  s.setTokens(access, refresh);
  try {
    const me = await api<Me>("/auth/me", { org: false });
    const m = me.memberships.find((x) => x.org_id === preferredOrg) ?? me.memberships[0];
    s.setOrg(m?.org_id ?? "demo-org");
    if (!m) return me.is_superadmin ? "/app/admin" : "/app";
    const landing: Record<string, string> = { insurance_analyst: "/app/risk", banking_analyst: "/app/risk", government_analyst: "/app/climate" };
    return landing[m.role] ?? "/app";
  } catch {
    // If /auth/me is unreachable (e.g. backend offline or demo mode), set default demo org and proceed to dashboard
    s.setOrg("demo-org");
    return "/app";
  }
}
