import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Industries" };

const IND = [
  { id: "farms", name: "Commercial farms", plan: "Farm Intelligence", uses: ["Choose the crop for each block before Maha or Yala", "Size irrigation needs in cubic metres from the seasonal water balance", "Compare margins under drier or hotter scenarios", "Track rainfall and soil wetness around each farm"] },
  { id: "banks", name: "Agricultural banks", plan: "Banking Intelligence", uses: ["See climate exposure across the districts in your loan book", "Attach a documented scenario report to each credit file", "Check whether a borrower's crop plan fits the season's climate", "Flag districts with rainfall deficits for early follow-up"] },
  { id: "insurance", name: "Insurance companies", plan: "Insurance Intelligence", uses: ["Monitor drought and excess-rain indicators by district", "Support underwriting with transparent, auditable risk components", "Receive alerts when rainfall falls well below normal", "Review portfolio concentration on a map"] },
  { id: "agribusiness", name: "Agribusinesses", plan: "Farm or Enterprise Intelligence", uses: ["Plan outgrower sourcing by district suitability", "Anticipate supply from seasonal conditions", "Compare price history across markets", "Share scenario reports with growers"] },
  { id: "government", name: "Government agencies", plan: "Enterprise Intelligence", uses: ["Compare district climate indicators over time", "Monitor crop suitability shifts under climate change", "Combine official production statistics with Earth observation", "Prioritise extension and irrigation support"] },
];

export default function Industries() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <h1 className="max-w-3xl text-5xl font-semibold">One data foundation, five ways of using it</h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">Each organization gets a workspace shaped by its role. Underwriting and lending outputs are decision support; AgriIntel never approves a claim or a loan on its own.</p>
      <div className="mt-14 grid gap-x-12 gap-y-14 md:grid-cols-2">
        {IND.map((i) => (
          <section key={i.id} id={i.id} className="scroll-mt-24 border-t border-line pt-6">
            <h2 className="text-2xl font-semibold">{i.name}</h2>
            <p className="mt-1 text-sm text-cyan">{i.plan}</p>
            <ul className="mt-4 space-y-2 text-muted">{i.uses.map((u) => <li key={u} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" />{u}</li>)}</ul>
          </section>
        ))}
      </div>
      <Link href="/contact?kind=demo" className="btn btn-primary mt-16">Talk to us about your use case</Link>
    </div>
  );
}
