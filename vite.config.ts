/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
    watch: {
      ignored: [
        /[\\/]\.edge.*/,
        /[\\/]\.chrome.*/,
        /[\\/]screenshots/,
        /[\\/]\.git/,
        '**/.edge*/**',
        '**/.chrome*/**',
        '**/screenshots/**',
        '**/coverage/**',
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          scanner: ['html5-qrcode', 'qrcode.react'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
