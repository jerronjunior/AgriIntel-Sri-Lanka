import { Logo } from "@/components/marketing/SiteChrome";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center"><div className="w-full max-w-md py-10">{children}</div></div>
      </div>
      <div aria-hidden className="relative hidden overflow-hidden border-l border-line bg-navy md:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgb(16_185_129/0.18),transparent_45%),radial-gradient(circle_at_30%_80%,rgb(34_211_238/0.12),transparent_40%)]" />
        <img src="/geo/sri-lanka.svg" alt="" className="absolute left-1/2 top-1/2 h-[70%] -translate-x-1/2 -translate-y-1/2 opacity-90" />
      </div>
    </div>
  );
}
