import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/ielts-speaking/',
  server: {
    port: 5178,
    strictPort: true,
  },
})
