"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth-store";
import type { District, Me } from "./types";

export function useMe() {
  const token = useAuth((s) => s.accessToken);
  return useQuery({ queryKey: ["me", token], queryFn: () => api<Me>("/auth/me", { org: false }), enabled: !!token, staleTime: 60_000 });
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
