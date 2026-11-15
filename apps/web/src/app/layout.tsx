import type { Metadata } from "next";
import Providers from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AgriIntel Sri Lanka — Satellite intelligence for agricultural decisions", template: "%s · AgriIntel Sri Lanka" },
  description: "NASA Earth observation turned into climate risk, crop suitability and profitability intelligence for Sri Lankan agriculture.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
