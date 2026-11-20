import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Mismo .env.local que la app de deportistas (mismo proyecto Firebase)
  envDir: repoRoot,
  server: { port: 5174, fs: { allow: [repoRoot] } },
  preview: { port: 4174 },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'rocketId Formadores',
        short_name: 'Formadores',
        description: 'Publica tus cursos, gestiona postulaciones y verifica certificaciones en rocketId.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // En el escritorio, la app ocupa también la barra de título
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        background_color: '#FAFAFA',
        theme_color: '#115E59',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // El login de Firebase siempre va a la red (proxy en vercel.json)
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
})
