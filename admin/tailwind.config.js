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
          black: "#08090d",
          dark: "#0f1118",
          card: "#151822",
          red: "#ff003c",
        },
        // Three levels: the page, panels on it, and things raised from a panel
        surface: {
          page: "#08090d",
          panel: "#0f1118",
          card: "#151822",
          raised: "#1d2130",
        },
        // Two weights of rule: `line` divides what is inside a panel, `edge` is the 2px frame around one
        line: "rgba(255, 255, 255, 0.09)",
        edge: "rgba(255, 255, 255, 0.2)",
        // Text. Each is at least 4.5:1 on the card surface.
        ink: {
          DEFAULT: "#f3f4f6",
          muted: "#a3a9b8",
          faint: "#8a91a3",
        },
        // The one colour charts draw with. Red stays free to mean "danger".
        chart: "#3987e5",
      },
      // The customer app's hard offset shadow, in a quiet slate. White is kept for what is under the pointer.
      boxShadow: {
        "hard-sm": "2px 2px 0 0 #3a4058",
        hard: "4px 4px 0 0 #3a4058",
        "hard-lg": "6px 6px 0 0 #3a4058",
        "hard-ink": "4px 4px 0 0 #f3f4f6",
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
