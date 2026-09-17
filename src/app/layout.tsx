import './globals.css'
import { TRPCProvider } from '@/lib/trpc-provider'

export const metadata = {
  title: 'DevHub — Developer Portal & Codebase Intelligence',
  description: 'Automated architectural analysis and repository health audits for developers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  )
}