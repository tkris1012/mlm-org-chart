import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/mlm-org-chart/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
