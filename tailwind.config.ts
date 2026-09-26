import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "'Helvetica Neue'",
          "Inter",
          "Arial",
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          50: "#f8efec",
          100: "#f2e0da",
          200: "#e5c6bc",
          300: "#d9a999",
          400: "#cc806b",
          500: "#b86f5d",
          600: "#a45a4c",
          700: "#8f4f45",
          800: "#78433b",
          900: "#4e3433",
        },
        ink: {
          50: "#faf6f2",
          100: "#f1eaeb",
          200: "#d8ccc7",
          300: "#c2b0a8",
          400: "#9c8a82",
          500: "#7c6b64",
          600: "#61514a",
          700: "#54433c",
          800: "#3b2e2a",
          900: "#2a1b18",
          950: "#1a0f0d",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(42, 27, 24, 0.05), 0 1px 3px 0 rgba(42, 27, 24, 0.06)",
        pop: "0 6px 24px -6px rgba(42, 27, 24, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
