'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { Button, ButtonLabel } from '@/components/ui/createui/button'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'
import { ArrowRight, Github, LayoutDashboard, Menu, X } from 'lucide-react'

interface LandingNavbarProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
}

const navLinks = [
  { label: 'Product', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Security', href: '#security' },
  { label: 'Pricing', href: '#pricing' },
]

export function LandingNavbar({ user }: LandingNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const primaryHref = user ? '/dashboard' : '/login'

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <header className="sticky top-3 z-50 w-full px-3 sm:px-4">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 rounded-full border border-white/10 bg-background/70 px-3 shadow-lg shadow-black/30 backdrop-blur-xl sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-85" aria-label="Arbor home">
          <Logo size="md" showWordmark />
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />

          {user ? (
            <Button asChild variant="neutral-light" appearance="outline" size="sm" shape="pill" className="hidden sm:inline-flex">
              <Link href="/dashboard">
                <LayoutDashboard aria-hidden="true" />
                <ButtonLabel>Dashboard</ButtonLabel>
              </Link>
            </Button>
          ) : (
            <Button asChild variant="neutral-light" appearance="ghost" size="sm" shape="pill" className="hidden sm:inline-flex">
              <Link href="/login">
                <ButtonLabel>Sign in</ButtonLabel>
              </Link>
            </Button>
          )}

          <Button asChild variant="primary" size="sm" shape="pill" className="gap-1.5">
            <Link href={primaryHref}>
              {!user && <Github aria-hidden="true" />}
              <ButtonLabel>{user ? 'Open workbench' : 'Analyze a repo'}</ButtonLabel>
              <ArrowRight className="hidden sm:block" aria-hidden="true" />
            </Link>
          </Button>

          <Button
            variant="neutral-light"
            appearance="ghost"
            size="md"
            shape="rounded"
            iconOnly
            className="lg:hidden"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <div
        id="landing-mobile-navigation"
        hidden={!mobileMenuOpen}
        className="mx-auto mt-2 max-w-[1280px] rounded-2xl border border-white/10 bg-background/90 px-3 py-3 shadow-lg shadow-black/30 backdrop-blur-xl lg:hidden"
      >
          <nav aria-label="Mobile navigation" className="mx-auto flex max-w-7xl flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMobileMenu}
                className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </a>
            ))}
            {!user && (
              <Link
                href="/login"
                onClick={closeMobileMenu}
                className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Sign in
              </Link>
            )}
          </nav>
      </div>
    </header>
  )
}
