import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts'],
          react:   ['react', 'react-dom'],
        }
      }
    },
    chunkSizeWarningLimit: 600,
  }
})
