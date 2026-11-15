import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api is proxied to the Spring Boot backend; in Docker, nginx does the same.
export default defineConfig({
  plugins: [react()],
  // "@/" points at src/, as shadcn/ui components expect.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Libraries in their own long-cached chunks, so the app code stays small. React stays in "vendor":
  // "ui" and "motion" only depend on it, never the other way round, so the chunks can't load in a cycle.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('bpmn-js') || id.includes('diagram-js') || id.includes('moddle')) return undefined; // lazy-loaded with the diagram
          if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('sonner')) return 'ui';
          if (id.includes('motion') || id.includes('framer-motion')) return 'motion';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8080',
        changeOrigin: true,
        // The browser talks to the same origin; dropping Origin keeps Spring's CORS check out of the way
        // no matter which host or IP the app is opened from.
        configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
      },
    },
  },
});
