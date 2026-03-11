import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/grammar-lab/',
  plugins: [react()],
  envDir: '../../',
  server: {
    port: 5176,
    strictPort: true,
  },
})
