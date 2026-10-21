import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // 🌟 KUNCI: Kunci React agar hanya 1 versi tunggal & jangan ikuti path symlink ke luar
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    },
  },
    build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        print: path.resolve(__dirname, 'print.html'),
      },
    },
  },
});