import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bcdfff",
          300: "#8ecbff",
          400: "#59afff",
          500: "#3091ff",
          600: "#1a73f5",
          700: "#145ce0",
          800: "#174bb5",
          900: "#19438f",
          950: "#102a5a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
