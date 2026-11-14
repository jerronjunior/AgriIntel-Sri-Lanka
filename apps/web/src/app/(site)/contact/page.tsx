import { Suspense } from "react";
import ContactForm from "./ContactForm";
export const metadata = { title: "Contact" };
export default function Contact() {
  return (
    <div className="mx-auto grid max-w-6xl gap-14 px-5 py-20 md:grid-cols-[0.8fr_1.2fr]">
      <div>
        <h1 className="text-5xl font-semibold">Talk to the AgriIntel team</h1>
        <p className="mt-5 text-lg text-muted">Book a demo with your own districts, ask for a plan quote, or send us a question. We reply by email.</p>
      </div>
      <Suspense><ContactForm /></Suspense>
    </div>
  );
}
