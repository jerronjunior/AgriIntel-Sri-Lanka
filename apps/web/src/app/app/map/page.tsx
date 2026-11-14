"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";
const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="skeleton h-[70vh]" /> });
export default function MapPage() { return <Suspense><MapView /></Suspense>; }
