import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: {
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router') || id.includes('node_modules/@supabase')) return 'vendor'
            return 'vendor'
          }
          if (id.includes('src/pages/Admin') || id.includes('src/components/AdminLayout') || id.includes('src/components/AdminBell')) return 'admin'
        },
      },
    },
  },
})
