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
            if (id.includes('@stripe')) return 'stripe';
            if (id.includes('posthog-js')) return 'analytics';
            if (id.includes('@supabase') || id.includes('jwt-decode')) return 'supabase';
            if (id.includes('@sentry')) return 'sentry';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('cmdk')) return 'cmdk';
            if (id.includes('howler')) return 'howler';
            if (id.includes('opentype.js')) return 'opentype';
            if (id.includes('gl') || id.includes('three') || id.includes('@dimforge') || id.includes('ammo.js')) return 'physics';
          }
        },
      },
    },
  },
})
