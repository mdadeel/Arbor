import type { Metadata } from 'next'
import './globals.css'
import { TRPCProvider } from '@/lib/trpc-provider'

const appUrl = process.env.APP_URL || 'https://arborgit.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Arbor — Map and Understand Your Codebase',
    template: '%s | Arbor',
  },
  description:
    'Turn a GitHub repository into an inspectable architecture map and health report. Arbor uses deterministic AST analysis to trace dependencies and surface actionable findings; temporary working copies are removed when processing finishes.',
  keywords: [
    'codebase intelligence',
    'github repository audit',
    'AST parser',
    'automated architectural audit',
    'dependency graph visualization',
    'technical debt reduction',
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
    title: 'Arbor — Map and Understand Your Codebase',
    description:
      'Explore repository structure, dependency graphs, and health findings with deterministic AST analysis.',
    url: appUrl,
    siteName: 'Arbor',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arbor — Map and Understand Your Codebase',
    description:
      'Explore repository structure, dependency graphs, and health findings with deterministic AST analysis.',
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
        'Repository scores across six analysis dimensions',
        'Interactive Dependency Graph Visualizer',
        'Circular Dependency Detection',
        'Conventional Commits Velocity Pulse',
        'Dynamic SVG README Shields Badges',
        'Temporary working copy removed when processing finishes',
      ],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
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