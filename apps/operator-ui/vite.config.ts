import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildId = process.env.BUILD_ID || new Date().toISOString().replace(/[:.]/g, '-')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash][extname]`,
        manualChunks(id) {
          // TEMP HOTFIX: collapse all node_modules into a single vendor chunk
          // to remove cross-chunk init order/circular import issues (qm/Jm TDZ).
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
  experimental: {
    renderBuiltUrl(filename) {
      if (filename.startsWith('assets/')) {
        return `/${filename}?v=${buildId}`
      }
      return filename
    },
  },
})
