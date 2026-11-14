"use client";
import { useAuth } from "./auth-store";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; form?: FormData; org?: boolean; auth?: boolean; raw?: boolean; firebaseToken?: string };

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const { refreshToken, setTokens, logout } = useAuth.getState();
  if (!refreshToken) return false;
  refreshing ??= fetch(`${API_URL}/auth/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }),
  }).then(async (r) => {
    if (!r.ok) { logout(); return false; }
    const d = await r.json();
    setTokens(d.access_token, d.refresh_token);
    return true;
  }).catch(() => false).finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T = unknown>(path: string, o: Opts = {}, retried = false): Promise<T> {
  const { accessToken, orgId } = useAuth.getState();
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  if (o.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (o.firebaseToken) headers.Authorization = `Bearer ${o.firebaseToken}`;
  if (o.org !== false && orgId) headers["X-Org-Id"] = orgId;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: o.method ?? (o.body !== undefined || o.form ? "POST" : "GET"), headers,
      body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // If localhost failed (e.g. Windows IPv6 ::1 resolution issue), try with 127.0.0.1 directly
    if (API_URL.includes("localhost")) {
      try {
        const fallbackUrl = API_URL.replace("localhost", "127.0.0.1");
        res = await fetch(`${fallbackUrl}${path}`, {
          method: o.method ?? (o.body !== undefined || o.form ? "POST" : "GET"), headers,
          body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        throw new ApiError(0, "network_error", "Can't reach the AgriIntel API. Check your connection or the API URL.");
      }
    } else {
      throw new ApiError(0, "network_error", "Can't reach the AgriIntel API. Check your connection or the API URL.");
    }
  }
  if (res.status === 401 && o.auth !== false && !retried && (await tryRefresh())) return api<T>(path, o, true);
  if (!res.ok) {
    let e: { error?: string; message?: string; details?: unknown } = {};
    try { e = await res.json(); } catch { /* non-JSON error */ }
    throw new ApiError(res.status, e.error ?? "http_error", e.message ?? `Request failed (${res.status})`, e.details);
  }
  if (o.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function download(path: string, filename: string) {
  const res = await api<Response>(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
