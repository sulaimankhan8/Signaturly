/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Legacy Brand tokens (backwards-compatible)
        brand: {
          black: "#08090d",
          dark: "#0f1118",
          card: "#151822",
          wine: "#3d0000",
          crimson: "#950101",
          red: "#ff003c",
          border: "rgba(255, 255, 255, 0.08)",
        },
        // Precision Monolith Surface Scale
        surface: {
          canvas: "#08090d",
          subtle: "#0d0f17",
          card: "#13151f",
          elevated: "#1a1d2b",
          overlay: "#222638",
        },
        // Semantic Typography & Content Scale
        content: {
          primary: "#f8fafc",
          secondary: "#cbd5e1",
          muted: "#94a3b8",
          subtle: "#64748b",
          inverse: "#08090d",
        },
        // Precision Brand Crimson
        crimson: {
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },
        // Legal Verification Seal & Compliance Gold
        seal: {
          gold: "#facc15",
          amber: "#f59e0b",
        },
        // Multi-Party Signer Role Color Codes
        signer: {
          self: "#e11d48",
          p1: "#3b82f6",
          p2: "#10b981",
          p3: "#a855f7",
          p4: "#f59e0b",
          p5: "#ec4899",
          viewer: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "-apple-system", "sans-serif"],
        display: ["'Space Grotesk'", "sans-serif"],
        legal: ["'Lora'", "serif"],
        serif: ["'Lora'", "serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        signature: ["'Great Vibes'", "cursive"],
        kalam: ["'Kalam'", "'Caveat'", "cursive", "sans-serif"],
        handwriting: ["'Kalam'", "'Caveat'", "cursive", "sans-serif"],
      },
      boxShadow: {
        "elevation-1": "0 1px 2px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
        "elevation-2": "0 4px 12px -2px rgba(0, 0, 0, 0.6), 0 2px 4px -1px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
        "elevation-3": "0 20px 35px -8px rgba(0, 0, 0, 0.8), 0 8px 16px -4px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)",
        "crimson-glow": "0 0 20px -3px rgba(225, 29, 72, 0.35)",
        "gold-glow": "0 0 18px -2px rgba(250, 204, 21, 0.30)",
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
    },
  },
  plugins: [],
};
