import './globals.css'
import { TRPCProvider } from '@/lib/trpc-provider'

export const metadata = {
  title: 'Arbor — Developer Portal & Codebase Intelligence',
  description: 'Automated architectural analysis and repository health audits for developers.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
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