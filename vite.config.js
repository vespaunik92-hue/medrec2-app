import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'EOA - Elektronik Ontang-Anting Melati',
        short_name: 'EOA',
        description: 'Aplikasi Rekam Medis Harian Melati',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'logo.png', // <--- Ganti jadi logo.png
            sizes: '192x192', // Kita paksa sistem anggap ini ukuran kecil
            type: 'image/png'
          },
          {
            src: 'logo.png', // <--- Ganti jadi logo.png juga
            sizes: '512x512', // Kita paksa sistem anggap ini ukuran besar
            type: 'image/png'
          }
        ]
      }
    })
  ],
})