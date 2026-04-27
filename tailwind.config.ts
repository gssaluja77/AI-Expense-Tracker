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
        // Soften the darkest slate shades so dark mode backgrounds and text
        // aren't at maximum contrast. Default Tailwind slate-950 is #020617
        // (near-black) which is painfully crisp against near-white text.
        // These overrides preserve the step between body / card / hover
        // layers (950 → 900 → 800) while making the overall surface easier
        // on the eyes. Light mode is unaffected (these shades aren't used
        // as backgrounds there).
        slate: {
          950: "#0b1220",
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
