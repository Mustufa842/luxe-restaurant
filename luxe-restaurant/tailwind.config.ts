import type { Config } from "tailwindcss";

/**
 * Design tokens — Luxe fine dining
 * Palette:
 *   onyx      #0B0B0D  base background, near-black with a warm cast
 *   graphite  #17161A  raised surfaces / cards
 *   champagne #C9A567  primary gold accent — used sparingly, on rules & CTAs
 *   burgundy  #4A1420  secondary depth accent — shadows, gradients, hover states
 *   ivory     #F3EEE3  primary text on dark
 *   ash       #8C877E  muted / secondary text
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        onyx: "#0B0B0D",
        graphite: "#17161A",
        champagne: "#C9A567",
        "champagne-bright": "#E4C989",
        burgundy: "#4A1420",
        ivory: "#F3EEE3",
        ash: "#8C877E",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"], // Cormorant Garamond
        body: ["var(--font-body)", "sans-serif"], // Inter
        mono: ["var(--font-mono)", "monospace"], // JetBrains Mono — prices, times
      },
      letterSpacing: {
        widest2: "0.35em",
      },
      backgroundImage: {
        "gold-fade": "linear-gradient(180deg, rgba(201,165,103,0.16) 0%, rgba(201,165,103,0) 100%)",
        "vignette": "radial-gradient(ellipse at center, transparent 40%, #0B0B0D 100%)",
      },
      boxShadow: {
        gold: "0 0 40px -10px rgba(201,165,103,0.35)",
      },
      transitionTimingFunction: {
        "silk": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
