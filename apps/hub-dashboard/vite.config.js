import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // API calls proxied to backend - avoids cross-origin / Chrome local network blocks
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      // So "Start Assignment" and learning tools work when all apps run together (pnpm dev)
      '/ielts-writing': { target: 'http://localhost:5174', changeOrigin: true },
      '/vocab-tool': { target: 'http://localhost:5175', changeOrigin: true },
      '/grammar-world': { target: 'http://localhost:5177', changeOrigin: true },
    },
  },
})
