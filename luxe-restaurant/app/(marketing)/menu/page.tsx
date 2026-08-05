import { MenuGrid } from "@/components/menu/MenuGrid";

export default function MenuPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-24">
      <span className="eyebrow">Currently serving</span>
      <h1 className="mt-4 font-display text-5xl font-light text-ivory">The Menu</h1>
      <p className="mt-4 max-w-lg text-sm text-ash">
        Sourced daily. Items and pricing reflect real-time availability from the kitchen.
      </p>
      <div className="mt-14">
        <MenuGrid />
      </div>
    </main>
  );
}
