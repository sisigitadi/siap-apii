import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
      // Aset statis: lampiran upload & PDF final surat (disajikan backend dari folder storage)
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/pdfs': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})

