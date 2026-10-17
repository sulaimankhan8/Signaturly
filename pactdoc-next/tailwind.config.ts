import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          canvas: "#08090d",
          card: "#13151f",
          elevated: "#1a1d2b",
          border: "rgba(255, 255, 255, 0.12)",
          "border-subtle": "rgba(255, 255, 255, 0.06)",
        },
        content: {
          primary: "#f8fafc",
          secondary: "#cbd5e1",
          muted: "#94a3b8",
          subtle: "#64748b",
        },
        crimson: {
          DEFAULT: "#e11d48",
          glow: "rgba(225, 29, 72, 0.25)",
          hover: "#be123c",
        },
        seal: {
          amber: "#f59e0b",
          emerald: "#10b981",
          blue: "#3b82f6",
          purple: "#8b5cf6",
        },
        signer: {
          p1: "#e11d48",
          p2: "#3b82f6",
          p3: "#10b981",
          p4: "#f59e0b",
          p5: "#8b5cf6",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        caveat: ["var(--font-caveat)", "cursive"],
        handwriting: ["var(--font-caveat)", "cursive"],
      },
      boxShadow: {
        "elevation-1": "0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)",
        "elevation-2": "0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.4)",
        "elevation-3": "0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -2px rgba(0, 0, 0, 0.5)",
        "crimson-glow": "0 0 20px -3px rgba(225, 29, 72, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
