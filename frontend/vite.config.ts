import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '')

  // Determine API target - use environment variable or fallback to localhost
  // In Docker, VITE_API_URL will be set to http://backend:8000
  const apiTarget = env.VITE_API_URL || 'http://localhost:8000'

  return {
    plugins: [
      react(),
      // Redirect /favicon.ico to /favicon.svg to avoid 404 (browsers often request .ico by default)
      {
        name: 'favicon-ico-redirect',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/favicon.ico') {
              res.statusCode = 302
              res.setHeader('Location', '/favicon.svg')
              res.end()
              return
            }
            next()
          })
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      // Allow connections from Docker network
      host: '0.0.0.0',
      // Watch options for Docker volume mounts
      watch: {
        usePolling: true,
        interval: 1000,
      },
      proxy: {
        // WebSocket proxy for real-time collaboration - must be before /api
        '/api/v1/ws': {
          target: apiTarget.replace('http', 'ws'),
          ws: true,
          changeOrigin: true,
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // Build optimization
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // Chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['@radix-ui/react-slot', 'lucide-react', 'clsx'],
          },
        },
      },
    },
    // Environment variable prefix
    envPrefix: 'VITE_',
  }
})
