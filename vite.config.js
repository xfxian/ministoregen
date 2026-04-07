import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react({ include: /\.(jsx?|tsx?)$/ })],
  base: '/ministoregen/',
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist'
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js'
  }
})
