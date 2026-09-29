import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Builds the clickable engagement mockups as a standalone static bundle.
 *
 * The mockups live in src/prototype and import the real API types, so the
 * screens can move into src/pages once the team approves them. Relative asset
 * paths let the bundle be opened from any host, including an Artifact.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3100,
    open: '/prototype.html',
  },
  build: {
    outDir: 'dist-prototype',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'prototype.html'),
    },
  },
})
