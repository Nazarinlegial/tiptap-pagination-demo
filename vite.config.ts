import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['src/workers/documentProcessor.worker.ts']
  }
})