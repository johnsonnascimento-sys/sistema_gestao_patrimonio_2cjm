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
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
