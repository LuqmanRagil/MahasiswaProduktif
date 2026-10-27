/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// `npm run build:preview` membuat satu file HTML (Mode Coba, tanpa Supabase, router memori)
// untuk dibagikan sebagai preview. Build biasa tetap multi-file.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "preview" ? [viteSingleFile()] : [])],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: mode === "preview" ? { outDir: "dist-preview", chunkSizeWarningLimit: 4000 } : { chunkSizeWarningLimit: 1200 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
}));
