import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL || 'https://arborgit.vercel.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/login',
          '/api/badge/',
          '/google7ecf99f475b9e5b2.html',
          '/llms.txt',
          '/icon.svg',
          '/favicon.svg',
        ],
        disallow: [
          '/dashboard/',
          '/projects/',
          '/settings/',
          '/admin/',
          '/api/',
        ],
      },
      {
        // Explicitly welcome AI & Generative Search Engines (GEO) for indexation
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'PerplexityBot',
          'ClaudeBot',
          'Claude-Web',
          'Google-Extended',
          'cohere-ai',
        ],
        allow: ['/', '/llms.txt', '/api/badge/'],
        disallow: ['/dashboard/', '/admin/', '/projects/', '/settings/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
