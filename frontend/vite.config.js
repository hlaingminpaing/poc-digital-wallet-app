import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api/users': {
        target: 'http://users-service:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/users/, '')
      },
      '/api/wallet': {
        target: 'http://wallet-service:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/wallet/, '')
      },
      '/api/transactions': {
        target: 'http://transactions-service:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/transactions/, '')
      },
      '/api/transfer': {
        target: 'http://transfer-service:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/transfer/, '')
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 3000
  }
})