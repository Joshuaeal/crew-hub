import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        /** Raconteur — Working files/style guide.pdf (feature palette) */
        cream: "#f7f4ef",
        surface: "#0f0c0c",
        /** Sidebar panels (PDF mock) */
        nav: "#070608",
        success: "#26c281",
        danger: "#ff4d4d",
        /**
         * Instance-driven brand colours.
         * Uses CSS vars set by `src/app/layout.tsx` so utilities like `text-brand/90` work.
         */
        brand: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          ember: "rgb(var(--secondary-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
