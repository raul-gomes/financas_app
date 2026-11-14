import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Performance budget (Fase 4.3): aviso se algum chunk > 250 kB (o gate gzip fica no check-bundle-size)
    chunkSizeWarningLimit: 250, // kB (raw); largest vendor chunk is ~223 kB
    sourcemap: false,
    rollupOptions: {
      output: {
        // Vendor chunks: long-lived cache and a smaller entry chunk.
        manualChunks: (id: string) => {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) return "react-vendor";
          if (id.includes("node_modules/d3-") || id.includes("node_modules/internmap")) return "d3";
          if (id.includes("node_modules/@supabase/")) return "supabase";
          if (id.includes("node_modules/zod/")) return "zod";
          if (id.includes("node_modules/@radix-ui/")) return "radix";
          return undefined;
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
