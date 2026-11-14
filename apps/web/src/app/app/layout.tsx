import AppShell from "@/components/app/AppShell";
export const metadata = { title: "Dashboard" };
export default function Layout({ children }: { children: React.ReactNode }) { return <AppShell>{children}</AppShell>; }
