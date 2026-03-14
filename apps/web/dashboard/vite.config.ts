import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          return 'vendor';
        },
      },
    },
  },
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
  ],
  server: {
    port: 8788,
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/proxy": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/asset": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/share": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/wp-content": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/wp-includes": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/remote-login.php": { target: "http://127.0.0.1:8787", changeOrigin: true }
    }
  }
});
