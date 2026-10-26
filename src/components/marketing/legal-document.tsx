import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { LandingFooter } from '@/components/marketing/landing-footer'
import { LEGAL_EFFECTIVE_DATE } from '@/lib/legal'

export interface LegalSection {
  id: string
  heading: string
  paragraphs: string[]
  items?: string[]
}

interface LegalDocumentProps {
  title: string
  intro: string
  sections: LegalSection[]
}

export function LegalDocument({ title, intro, sections }: LegalDocumentProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex transition-opacity hover:opacity-85" aria-label="Arbor home">
            <Logo size="sm" showWordmark />
          </Link>
          <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <article className="space-y-10">
          <header className="space-y-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Effective date: <time dateTime={LEGAL_EFFECTIVE_DATE}>{LEGAL_EFFECTIVE_DATE}</time>
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">{intro}</p>
          </header>

          <nav aria-label="On this page" className="rounded-xl border border-border bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
            <ol className="grid gap-2 text-sm sm:grid-cols-2">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-foreground underline-offset-4 hover:underline">
                    {index + 1}. {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 space-y-3">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {index + 1}. {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-base leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {section.items && (
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </main>

      <LandingFooter />
    </div>
  )
}
