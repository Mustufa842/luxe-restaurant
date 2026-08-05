import Link from "next/link";
import dynamic from "next/dynamic";

// The 3D canvas is client-only and heavy — load it lazily, no SSR.
const Hero3DScene = dynamic(
  () => import("@/components/3d/Hero3DScene").then((m) => m.Hero3DScene),
  { ssr: false }
);

export default function HomePage() {
  return (
    <main>
      <section className="relative h-screen w-full overflow-hidden bg-onyx">
        <Hero3DScene />
        <div className="pointer-events-none absolute inset-0 bg-vignette" />

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <span className="eyebrow mb-6">Est. reservation only · Downtown</span>
          <h1 className="font-display text-6xl font-light leading-[0.95] text-ivory md:text-8xl">
            Luxe
          </h1>
          <p className="mt-6 max-w-md font-body text-base text-ash md:text-lg">
            An evening built around what arrives at the table — nothing more, nothing less.
          </p>
          <div className="mt-10 flex gap-4">
            <Link
              href="/reservations"
              className="rounded-sm border border-champagne bg-champagne px-8 py-3 font-mono text-xs uppercase tracking-widest2 text-onyx transition-all duration-300 ease-silk hover:bg-champagne-bright"
            >
              Reserve
            </Link>
            <Link
              href="/menu"
              className="rounded-sm border border-champagne/40 px-8 py-3 font-mono text-xs uppercase tracking-widest2 text-ivory transition-all duration-300 ease-silk hover:border-champagne"
            >
              View Menu
            </Link>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 font-mono text-[10px] uppercase tracking-widest2 text-ash">
          Scroll
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-32 text-center">
        <span className="eyebrow">The philosophy</span>
        <p className="mt-6 font-display text-3xl font-light leading-relaxed text-ivory md:text-4xl">
          Nine courses, one narrative. Each plate is built from what the market gave us
          that morning — never the other way around.
        </p>
      </section>

      <section className="hairline mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-3">
          {[
            { label: "Tasting Menu", desc: "Nine courses, wine pairing optional." },
            { label: "Chef's Table", desc: "Six seats, front row to the kitchen." },
            { label: "Private Dining", desc: "For parties of eight to twenty." },
          ].map((item) => (
            <div key={item.label}>
              <h3 className="font-display text-2xl font-light text-champagne">{item.label}</h3>
              <p className="mt-2 text-sm text-ash">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
