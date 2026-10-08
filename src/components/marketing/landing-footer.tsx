import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'

const productLinks = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Architecture map', href: '#architecture' },
  { label: 'Repository health', href: '#health' },
  { label: 'Example findings', href: '#security' },
  { label: 'Pricing', href: '#pricing' },
]

export function LandingFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card text-sm text-muted-foreground" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">Arbor footer</h2>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-10 border-b border-border pb-9 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div className="space-y-4">
            <Link href="/" className="inline-flex transition-opacity hover:opacity-85" aria-label="Arbor home">
              <Logo size="sm" showWordmark />
            </Link>
            <p className="max-w-sm text-sm leading-relaxed">
              A clearer map of your codebase, grounded in the structure of the code you ship.
            </p>
          </div>

          <nav aria-label="Footer product navigation" className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Product</h3>
            <ul className="space-y-2.5 text-sm">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-foreground">{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Account &amp; trust</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/login" className="transition-colors hover:text-foreground">Sign in with GitHub</Link>
              </li>
              <li>
                <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                  Product overview <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              </li>
              <li className="flex items-center gap-2 pt-1 text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                <span>Choose repositories · source removed after analysis</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Arbor. Built for developers who want to understand the system they are changing.</p>
          <Link href="/" className="w-fit transition-colors hover:text-foreground">Back to top ↑</Link>
        </div>
      </div>
    </footer>
  )
}
