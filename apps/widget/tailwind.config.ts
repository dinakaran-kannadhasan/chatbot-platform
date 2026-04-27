import type { Config } from "tailwindcss";

/**
 * Why a separate Tailwind config for the widget?
 *
 * The widget's CSS must be completely isolated from the host site.
 * We use a unique prefix 'cw-' (chatbot widget) on all classes.
 * This prevents collisions like .flex or .text-sm conflicting
 * with Bootstrap or Tailwind already on the host site.
 */
const config: Config = {
  /**
   * prefix: 'cw-' means all classes become:
   * cw-flex, cw-bg-white, cw-text-sm etc.
   * Zero chance of conflicting with host site CSS.
   */
  prefix: "cw-",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
