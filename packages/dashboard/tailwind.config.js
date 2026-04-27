/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          900: "#312e81",
        },
        surface: {
          DEFAULT: "#0f1117",
          raised: "#1a1d2e",
          overlay: "#242838",
        },
        danger: "#ef4444",
        success: "#22c55e",
        warning: "#f59e0b",
      },
    },
  },
  plugins: [],
};
