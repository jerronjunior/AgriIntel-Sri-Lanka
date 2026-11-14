"use client";
import { useDistricts } from "@/lib/hooks";
export default function DistrictSelect({ value, onChange, id = "district" }: { value: string; onChange: (v: string) => void; id?: string }) {
  const d = useDistricts();
  const byProv = (d.data?.items ?? []).reduce<Record<string, string[]>>((a, x) => ((a[x.province] ??= []).push(x.name), a), {});
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(byProv).map(([p, ds]) => <optgroup key={p} label={`${p} Province`}>{ds.map((n) => <option key={n}>{n}</option>)}</optgroup>)}
    </select>
  );
}
