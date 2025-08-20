import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-router')) return 'react-vendor';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('driver.js')) return 'driver';
            if (id.includes('echarts')) return 'echarts';
          }
        },
      },
    },
  },
})
