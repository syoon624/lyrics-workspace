import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  cacheDir: ".vite-cache",
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setupTests.js",
  },
  server: {
    host: "localhost",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:8090",
        changeOrigin: true,
      },
    },
  },
});
