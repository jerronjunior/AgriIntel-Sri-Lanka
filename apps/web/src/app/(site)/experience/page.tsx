"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import Explorer from "@/components/agrisphere/Explorer";
import Globe from "@/components/globe/Globe";

export default function ExperiencePage() {
  const hero = useRef<HTMLDivElement>(null);
  const progress = useRef(0);

  useEffect(() => {
    const updateProgress = () => {
      const element = hero.current;
      if (!element) return;
      const range = element.offsetHeight - window.innerHeight;
      progress.current = range > 0
        ? Math.min(1, Math.max(0, -element.getBoundingClientRect().top / range))
        : 0;
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return (
    <main>
      <section ref={hero} className="relative overflow-hidden border-b border-cyan/20 bg-[#061827] text-[#f4fbff]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.05)_1px,transparent_1px)] bg-[size:56px_56px] opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_76%_34%,rgba(34,211,238,0.2),transparent_42%),radial-gradient(ellipse_at_20%_90%,rgba(16,185,129,0.14),transparent_40%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 md:min-h-[82vh] md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative z-10">
            <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-[#9cb5c9] transition hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to AgriIntel
            </Link>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-cyan/10 px-3.5 py-1 text-xs font-semibold text-cyan shadow-[0_0_24px_rgba(34,211,238,0.12)]">
              <Sparkles className="h-3.5 w-3.5" />
              Sri Lanka intelligence experience
            </div>
            <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              See the signals behind every district decision.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-[#b8cbd9] sm:text-lg">
              Explore the animated earth-observation view, then drill into Sri Lankan provinces and districts with one interactive intelligence workspace.
            </p>
            <Link href="/agrisphere" className="btn btn-primary mt-8 !px-5 !py-3 shadow-[0_0_28px_rgba(16,185,129,0.22)]">
              Open district explorer <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative h-[420px] rounded-[2rem] border border-cyan/20 bg-[#081f31]/50 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:h-[600px]">
            <div className="pointer-events-none absolute inset-4 rounded-[1.5rem] border border-white/5" />
            <Globe progress={progress} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <div className="mb-10 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan">District intelligence</span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-snow sm:text-4xl">Sri Lanka, down to the district</h2>
          <p className="mt-4 text-muted">
            Select a province or district to compare climate, water, soil, crop, and yield signals.
          </p>
        </div>
        <Explorer mode="demo" />
      </section>
    </main>
  );
}
