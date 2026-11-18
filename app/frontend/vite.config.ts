import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    // Necessário no Docker (bind mount do Windows não propaga inotify):
    // garante HMR e invalidação de cache de transform ao editar arquivos
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // Performance budget (Fase 4.3): aviso se algum chunk > 250 kB (o gate gzip fica no check-bundle-size)
    chunkSizeWarningLimit: 250, // kB (raw); largest vendor chunk is ~223 kB
    sourcemap: false,
    rolldownOptions: {
      output: {
        // Vendor chunks: long-lived cache and a smaller entry chunk (Rolldown code-splitting groups;
        // the highest-priority matching group wins, mirroring the former manualChunks order).
        codeSplitting: {
          groups: [
            { name: "react-vendor", test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/, priority: 5 },
            { name: "d3", test: /node_modules[\\/](d3-[^\\/]+|internmap)[\\/]/, priority: 4 },
            { name: "supabase", test: /node_modules[\\/]@supabase[\\/]/, priority: 3 },
            { name: "zod", test: /node_modules[\\/]zod[\\/]/, priority: 2 },
            { name: "radix", test: /node_modules[\\/]@radix-ui[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: false,
    css: false,
    // Placeholder values (not secrets) so modules that build the Supabase client at import
    // time can be loaded by tests that only mock the services they exercise.
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
}));
