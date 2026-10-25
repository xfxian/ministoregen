import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

// The version shown in the app: set by CI (APP_VERSION), else `git describe`
// (e.g. v0.2.0-3-gabc1234), else "dev". See docs/VERSIONING.md.
function appVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION
  try {
    return execSync('git describe --tags --always --dirty', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [react({ include: /\.(jsx?|tsx?)$/ })],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion())
  },
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
