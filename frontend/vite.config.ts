import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '')

  // Determine API target - use environment variable or fallback to localhost
  // In Docker, VITE_API_URL will be set to http://backend:8000
  const apiTarget = env.VITE_API_URL || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
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
            ui: ['@radix-ui/react-slot', 'lucide-react', 'clsx', 'tailwind-merge'],
          },
        },
      },
    },
    // Environment variable prefix
    envPrefix: 'VITE_',
    // Optimize deps for Lexical
    optimizeDeps: {
      include: [
        'lexical',
        '@lexical/react/LexicalComposer',
        '@lexical/react/LexicalRichTextPlugin',
        '@lexical/react/LexicalContentEditable',
        '@lexical/react/LexicalHistoryPlugin',
        '@lexical/react/LexicalAutoFocusPlugin',
        '@lexical/react/LexicalOnChangePlugin',
        '@lexical/react/LexicalErrorBoundary',
        '@lexical/react/LexicalListPlugin',
        '@lexical/react/LexicalLinkPlugin',
        '@lexical/react/LexicalMarkdownShortcutPlugin',
        '@lexical/rich-text',
        '@lexical/list',
        '@lexical/code',
        '@lexical/link',
        '@lexical/table',
        '@lexical/markdown',
        '@lexical/utils',
        '@lexical/html',
      ],
    },
  }
})
