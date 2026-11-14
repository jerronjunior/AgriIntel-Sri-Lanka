"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <div className="grid min-h-[60vh] place-items-center px-5 text-center"><div><h1 className="text-3xl font-semibold">Something broke on this page</h1><p className="mt-3 text-muted">{error.message}</p><button onClick={reset} className="btn btn-primary mt-6">Try again</button></div></div>;
}
