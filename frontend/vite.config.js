/**
 * Modulo: frontend
 * Arquivo: vite.config.js
 * Funcao no sistema: configuracao de build/dev server para React + Tailwind.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("html5-qrcode")) return "scanner-vendor";
          if (id.includes("react-markdown") || id.includes("remark-gfm")) return "wiki-vendor";
          if (id.includes("@tanstack/react-query") || id.includes("idb-keyval")) return "data-vendor";
          if (
            id.includes("react-dom")
            || id.match(/node_modules[\\/](react|scheduler)[\\/]/)
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-utils/setupTests.js",
  },
});
