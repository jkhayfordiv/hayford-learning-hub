import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/ielts-writing/',
  plugins: [react()],
  envDir: '../../',
  server: {
    port: 5174,
    strictPort: true
  }
})
