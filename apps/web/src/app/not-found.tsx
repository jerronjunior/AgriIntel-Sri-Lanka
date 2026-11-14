import Link from "next/link";
export default function NotFound() {
  return <div className="grid min-h-screen place-items-center px-5 text-center"><div><h1 className="text-5xl font-semibold">Off the map</h1><p className="mt-3 text-muted">This page doesn&apos;t exist.</p><Link href="/" className="btn btn-primary mt-6">Go to the home page</Link></div></div>;
}
