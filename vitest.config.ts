import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        jsx: "react-jsx",
      },
    },
  },
  oxc: false,
  test: {
    environment: "jsdom",
    include: [
      "src/**/*.test.{ts,tsx}",
      "../server/**/*.test.ts",
      "../shared/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/**/*.{ts,tsx}",
        "../server/**/*.ts",
        "../shared/**/*.ts",
      ],
      exclude: [
        "src/main.tsx",
        "src/**/*.test.{ts,tsx}",
        "../server/**/*.test.ts",
        "../shared/**/*.test.ts",
      ],
    },
  },
});
