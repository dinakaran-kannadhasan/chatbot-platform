import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

/**
 * Why IIFE format instead of ESM?
 *
 * ESM requires <script type="module"> and a modern browser.
 * IIFE (Immediately Invoked Function Expression) works in any
 * browser, any website, any CMS including WordPress.
 *
 * The bundle wraps everything in a self-executing function:
 * (function() { ... all our code ... })()
 *
 * This means:
 * 1. No global namespace pollution — our variables are private
 * 2. No module system required — works with a plain <script> tag
 * 3. No conflicts with the host site's JavaScript
 */
export default defineConfig({
  plugins: [react()],

  build: {
    lib: {
      entry: resolve(__dirname, "src/embed.ts"),
      name: "ChatbotWidget",
      fileName: "chatbot",
      formats: ["iife"],
    },

    rollupOptions: {
      /**
       * Why inline all dependencies?
       * The widget is embedded on third-party sites.
       * We can't assume React or any other library is available.
       * Everything must be bundled into one self-contained file.
       *
       * This makes the file larger (~150kb gzipped) but completely
       * self-sufficient — zero dependencies on the host site.
       */
      external: [],
      output: {
        /**
         * inlineDynamicImports: true — bundle all dynamic imports
         * into the single output file. No code splitting for a widget.
         */
        inlineDynamicImports: true,
      },
    },

    /**
     * Target modern browsers.
     * We don't need IE11 support — anyone who needs the chatbot
     * is using a modern browser.
     */
    target: "es2020",

    /**
     * minify: true in production reduces file size ~60%.
     * terser produces smaller output than esbuild for IIFE.
     */
    minify: true,

    outDir: "dist",
  },

  resolve: {
    alias: {
      "@chatbot/types": resolve(__dirname, "../../packages/types/src/index.ts"),
    },
  },
});
