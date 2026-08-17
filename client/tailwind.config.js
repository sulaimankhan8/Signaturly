/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#08090d",
          dark: "#0f1118",
          card: "#151822",
          wine: "#3d0000",
          crimson: "#950101",
          red: "#ff003c",
          border: "rgba(255, 255, 255, 0.08)",
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        display: ["'Space Grotesk'", "sans-serif"],
        legal: ["'Lora'", "serif"],
        serif: ["'Lora'", "serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        signature: ["'Great Vibes'", "cursive"],
      },

    },
  },
  plugins: [],
};
