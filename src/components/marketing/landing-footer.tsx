'use client'

import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { ExternalLink, Github, ShieldCheck } from 'lucide-react'

export function LandingFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card text-muted-foreground text-xs" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">Footer Navigation</h2>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        {/* 4-Column SEO Footer Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 lg:gap-10 pb-16 border-b border-border">
          {/* Column 1: Product */}
          <div className="space-y-4">
            <h3 className="font-mono text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Product
            </h3>
            <ul className="space-y-2.5">
              <li>
                <a href="#architecture" className="hover:text-foreground transition-colors">
                  Visual Architecture Graph
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-foreground transition-colors">
                  Deterministic AST Engine
                </a>
              </li>
              <li>
                <a href="#health" className="hover:text-foreground transition-colors">
                  Health Pulse &amp; Velocity
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  Tech Debt &amp; Secret Shield
                </a>
              </li>
              <li>
                <a href="#comparison" className="hover:text-foreground transition-colors">
                  Arbor vs Traditional Tools
                </a>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Dynamic SVG README Badges
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Resources */}
          <div className="space-y-4">
            <h3 className="font-mono text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Resources
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link href="/admin" className="hover:text-[#65DCD5] transition-colors font-medium text-foreground/90">
                  Admin &amp; Metrics Panel
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Documentation Hub
                </Link>
              </li>
              <li>
                <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  <span>llms.txt (AI Search Manifest)</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-foreground transition-colors">
                  Babel AST Parsing Spec
                </a>
              </li>
              <li>
                <a href="#health" className="hover:text-foreground transition-colors">
                  Conventional Commits Grammar
                </a>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  OpenAPI 3.0 Runner Proxy
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Personal Access Tokens (PAT)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Solutions */}
          <div className="space-y-4">
            <h3 className="font-mono text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Solutions
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Solo Developers &amp; Builders
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Engineering Leads &amp; Architects
                </Link>
              </li>
              <li>
                <a href="#comparison" className="hover:text-foreground transition-colors">
                  Monorepo Dependency Triage
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  Rapid Codebase Onboarding
                </a>
              </li>
              <li>
                <a href="#comparison" className="hover:text-foreground transition-colors">
                  Pre-Merge Architecture Checks
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Company, Security & Legal */}
          <div className="space-y-4 col-span-2 sm:col-span-1">
            <h3 className="font-mono text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Company &amp; Trust
            </h3>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>Zero source code stored</span>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground transition-colors">
                  Ephemeral in-memory sandbox
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground transition-colors">
                  Read-only OAuth scope requested
                </a>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Brand, Status, Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
            <Link href="/" className="transition-opacity hover:opacity-90">
              <Logo size="sm" showWordmark />
            </Link>
            <span className="hidden sm:inline text-border">|</span>
            <span className="text-[11px]">
              &copy; {currentYear} Arbor. Built for software engineers who demand deterministic clarity.
            </span>
          </div>

          <div className="flex items-center gap-5 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All Systems Operational
            </span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}