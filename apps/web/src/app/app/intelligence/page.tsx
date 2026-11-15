import Explorer from "@/components/agrisphere/Explorer";

export const metadata = { title: "District intelligence" };

export default function DistrictIntelligencePage() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-2">
      <h1 className="text-3xl font-semibold">District intelligence</h1>
      <p className="max-w-3xl text-muted">Province to district drill-down with each district&apos;s decision package. Values tagged Live come from NASA POWER through your workspace; the rest are tagged Demo until their data sources are connected.</p>
      <div className="pt-3"><Explorer mode="live" /></div>
    </div>
  );
}
