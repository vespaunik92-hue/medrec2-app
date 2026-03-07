import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo2.png', 'apple-touch-icon.png'], // Sesuaikan dengan nama file icon kamu
      manifest: {
        name: 'SIMPAN - Sistem Manajemen Pelayanan',
        short_name: 'SIMPAN',
        description: 'Sistem Manajemen Pelayanan Abi Nugroho',
        theme_color: '#4f46e5', // Warna indigo agar senada dengan tema aplikasi
        background_color: '#f8fafc', // Warna slate-50
        display: 'standalone',
        icons: [
          {
            src: 'logo2.png', // Pastikan ini mengarah ke file icon kotak milikmu
            sizes: '192x192', 
            type: 'image/png'
          },
          {
            src: 'logo2.png', // Pastikan ini mengarah ke file icon kotak milikmu
            sizes: '512x512', 
            type: 'image/png'
          }
        ]
      }
    })
  ],
})