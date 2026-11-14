import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (<><SiteHeader /><main className="pt-16">{children}</main><SiteFooter /></>);
}
