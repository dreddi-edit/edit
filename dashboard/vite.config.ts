import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: { sourcemap: false },
  
  plugins: [react()],
  server: {
    port: 8788,  // Frontend Port
    proxy: {
        '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
        '/proxy': { target: 'http://127.0.0.1:8787', changeOrigin: true },
        '/asset': { target: 'http://127.0.0.1:8787', changeOrigin: true },
        '/wp-content': { target: 'http://127.0.0.1:8787', changeOrigin: true },
        '/wp-includes': { target: 'http://127.0.0.1:8787', changeOrigin: true },
        '/remote-login.php': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      },
  },
});
