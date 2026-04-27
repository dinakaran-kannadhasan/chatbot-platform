import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /**
       * Custom colors matching AppViewX brand.
       * Using CSS variables means we can switch themes
       * at runtime without rebuilding.
       */
      colors: {
        brand: {
          50: "#e6f1fb",
          100: "#b5d4f4",
          500: "#378add",
          600: "#185fa5",
          700: "#0c447c",
          900: "#042c53",
        },
      },
      /**
       * Custom animation for the typing indicator dots.
       * Three dots bounce in sequence — classic chat feel.
       */
      keyframes: {
        bounce: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "bounce-dot": "bounce 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
