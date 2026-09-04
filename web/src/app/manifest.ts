import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'Kanvise',
    short_name: 'Kanvise',
    description: 'Run classes, learn, complete assessments, and manage your school from Kanvise.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f7f5',
    theme_color: '#2e2877',
    orientation: 'any',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
