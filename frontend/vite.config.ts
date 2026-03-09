import fs from 'node:fs'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode (loadEnv only reads .env files, not process.env)
  const env = loadEnv(mode, process.cwd(), '')
  // Prefer process.env (Docker Compose sets this) over .env files so Docker works
  const apiUrl = process.env.VITE_API_URL || env.VITE_API_URL || ''

  // Determine API target for the proxy
  // In Docker: VITE_API_URL=http://backend:8000 (set by docker-compose)
  // Locally: use localhost since "backend" hostname doesn't resolve on the host
  // In Docker: "backend" can fail to resolve (getaddrinfo ENOTFOUND on some setups);
  // use host.docker.internal to reach the host's port mapping (works on Mac/Win;
  // Linux needs extra_hosts: host.docker.internal:host-gateway)
  const isDocker = fs.existsSync('/.dockerenv')
  const backendPort = process.env.BACKEND_PORT || '8000'
  let apiTarget = apiUrl || 'http://localhost:8000'
  if (apiTarget.includes('://backend')) {
    if (!isDocker) {
      apiTarget = `http://localhost:${backendPort}`
    } else {
      apiTarget = `http://host.docker.internal:${backendPort}`
    }
  }

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
