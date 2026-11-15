"use client";
import { useEffect, useState } from "react";
import { findDistrict, loadNasaDataset, type NasaDataset, type NasaDistrict } from "./nasa-kit";

type State = { loading: boolean; error: string | null; dataset: NasaDataset | null; district: NasaDistrict | null };

/** React hook: const { district, dataset, loading, error } = useNasaDistrict("Kandy"); */
export function useNasaDistrict(nameOrCode: string | null, url?: string): State {
  const [s, set] = useState<State>({ loading: true, error: null, dataset: null, district: null });
  useEffect(() => {
    let live = true;
    set((p) => ({ ...p, loading: true, error: null }));
    loadNasaDataset(url)
      .then((ds) => live && set({ loading: false, error: null, dataset: ds, district: nameOrCode ? findDistrict(ds, nameOrCode) : null }))
      .catch((e: Error) => live && set({ loading: false, error: e.message, dataset: null, district: null }));
    return () => { live = false; };
  }, [nameOrCode, url]);
  return s;
}
