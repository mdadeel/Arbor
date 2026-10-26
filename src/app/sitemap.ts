import type { MetadataRoute } from 'next'
import { LEGAL_LAST_UPDATED } from '@/lib/legal'

const baseUrl = process.env.APP_URL || 'https://arborgit.vercel.app'

// Only public, indexable pages belong here. The sign-in page is intentionally
// excluded: it is thin, auth-only content and is reachable through navigation.
// `lastModified` is the legal effective date rather than the request time, so it
// only changes when the legal text does.

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${baseUrl}`,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: LEGAL_LAST_UPDATED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: LEGAL_LAST_UPDATED,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
