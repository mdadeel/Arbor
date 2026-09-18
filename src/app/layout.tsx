import type { Metadata } from 'next'
import './globals.css'
import { TRPCProvider } from '@/lib/trpc-provider'

const appUrl = process.env.APP_URL || 'https://arborgit.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Arbor — Understand Any Codebase in 30 Seconds',
    template: '%s | Arbor',
  },
  description:
    'Understand any codebase in 30 seconds. A deterministic AST parser delivers automated architectural audits, dependency graph visualization, tech debt reduction, and AI codebase documentation from any GitHub repo.',
  keywords: [
    'codebase intelligence',
    'github repository audit',
    'AST parser',
    'automated architectural audit',
    'dependency graph visualization',
    'technical debt reduction',
    'AI codebase documentation',
    'architecture visualizer',
    'tech debt detector',
    'dependency graph',
    'code health score',
    'developer portal',
    'software architecture',
  ],
  authors: [{ name: 'Arbor Team', url: appUrl }],
  creator: 'Arbor',
  publisher: 'Arbor',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Arbor — Understand Any Codebase in 30 Seconds',
    description:
      'Understand any codebase in 30 seconds with deterministic AST analysis and live repository health metrics.',
    url: appUrl,
    siteName: 'Arbor',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arbor — Understand Any Codebase in 30 Seconds',
    description:
      'Understand any codebase in 30 seconds with deterministic AST analysis and live repository health metrics.',
    creator: '@arborgit',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'google7ecf99f475b9e5b2',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': `${appUrl}/#software`,
      name: 'Arbor',
      operatingSystem: 'Web',
      applicationCategory: 'DeveloperApplication',
      url: appUrl,
      sameAs: ['https://github.com/arborgit'],
      description:
        'Automated architectural analysis and codebase intelligence for developers. AST-based dependency graphs, tech debt detection, and repository health scores.',
      featureList: [
        'Deterministic Babel AST Analysis',
        'Sub-30s Repository Audit',
        'Interactive Dependency DAG Visualizer',
        'Circular Dependency Detection',
        'Conventional Commits Velocity Pulse',
        'Dynamic SVG README Shields Badges',
        'Zero Private Source Code Retained',
      ],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '127',
      },
      author: {
        '@type': 'Organization',
        name: 'Arbor',
        url: appUrl,
      },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.remove('dark')}catch(e){}`,
          }}
        />
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  )
}