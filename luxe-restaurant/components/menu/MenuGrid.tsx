"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  allergens: string[];
  imageUrl: string | null;
};

const CATEGORIES = ["ALL", "AMUSE_BOUCHE", "APPETIZER", "MAIN", "DESSERT", "BEVERAGE", "TASTING_MENU"];

function ParallaxCard({ item }: { item: MenuItem }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 200, damping: 20 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      className="group relative rounded-sm border border-champagne/15 bg-graphite p-6 transition-colors duration-300 ease-silk hover:border-champagne/50"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-xl font-light text-ivory">{item.name}</h3>
        <span className="font-mono text-sm text-champagne">
          ${(item.priceCents / 100).toFixed(2)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ash">{item.description}</p>
      {item.allergens.length > 0 && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest2 text-ash/70">
          Contains: {item.allergens.join(", ")}
        </p>
      )}
    </motion.div>
  );
}

export function MenuGrid() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = category === "ALL" ? "" : `?category=${category}`;
    fetch(`/api/menu${qs}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div>
      <div className="mb-10 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-sm border px-4 py-2 font-mono text-[11px] uppercase tracking-widest2 transition-colors duration-300 ease-silk ${
              category === c
                ? "border-champagne bg-champagne text-onyx"
                : "border-champagne/25 text-ash hover:border-champagne/60 hover:text-ivory"
            }`}
          >
            {c.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="font-mono text-sm text-ash">Loading menu…</p>
      ) : items.length === 0 ? (
        <p className="font-mono text-sm text-ash">Nothing available in this category right now.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ParallaxCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
