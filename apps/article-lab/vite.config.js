import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/article-lab/',
  plugins: [react()],
  server: {
    port: 5176,
  },
})
