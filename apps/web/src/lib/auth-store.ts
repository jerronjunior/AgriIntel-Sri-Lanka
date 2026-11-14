"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// NOTE: tokens are persisted in localStorage for the MVP. Production hardening: move to a
// Next.js BFF route that keeps the refresh token in an httpOnly, SameSite=strict cookie.
type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  orgId: string | null;
  setTokens: (a: string, r: string) => void;
  setOrg: (id: string | null) => void;
  logout: () => void;
};

export const useAuth = create<AuthState>()(persist((set) => ({
  accessToken: null, refreshToken: null, orgId: null,
  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  setOrg: (orgId) => set({ orgId }),
  logout: () => set({ accessToken: null, refreshToken: null, orgId: null }),
}), { name: "agriintel-auth" }));
