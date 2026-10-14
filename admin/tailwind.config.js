/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // The customer app's palette (client/tailwind.config.js), so the two read as one product
        brand: {
          black: "#07080c",
          dark: "#0c0e14",
          card: "#11141c",
          red: "#ff003c",
        },
        // Three levels: the page, panels on it, and things raised from a panel
        surface: {
          page: "#07080c",
          panel: "#0c0e14",
          card: "#11141c",
          raised: "#191d28",
        },
        // Two weights of rule: `line` divides what is inside a panel, `edge` is the frame around one
        line: "rgba(255, 255, 255, 0.06)",
        edge: "rgba(255, 255, 255, 0.09)",
        // Text. Each is at least 4.5:1 on the card surface.
        ink: {
          DEFAULT: "#f3f4f6",
          muted: "#a3a9b8",
          faint: "#8a91a3",
        },
        // The accent: what is selected, and the one main action on a screen
        accent: {
          DEFAULT: "#ef2b4a",
          hover: "#ff4560",
          deep: "#c8102e",
        },
        // The colour a chart draws with when it has no colour of its own
        chart: "#3987e5",
      },
      boxShadow: {
        "soft-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.4)",
        soft: "0 8px 24px -12px rgba(0, 0, 0, 0.7), 0 1px 2px 0 rgba(0, 0, 0, 0.4)",
        "soft-lg": "0 24px 60px -20px rgba(0, 0, 0, 0.85), 0 2px 6px 0 rgba(0, 0, 0, 0.4)",
        // The glow of the red main action
        accent: "0 8px 24px -10px rgba(239, 43, 74, 0.7)",
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
