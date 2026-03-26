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
      // So "Start Assignment" and learning tools work when all apps run together (pnpm dev)
      '/ielts-writing': { target: 'http://localhost:5174', changeOrigin: true },
      '/vocab-tool': { target: 'http://localhost:5175', changeOrigin: true },
      '/grammar-world': { target: 'http://localhost:5176', changeOrigin: true },
    },
  },
})
