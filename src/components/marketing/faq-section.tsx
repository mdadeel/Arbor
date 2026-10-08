import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/createui/badge'
import { faqs, type FaqItem } from './faq-data'

export { faqs, type FaqItem }

export function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-4xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto mb-8 max-w-2xl space-y-3 text-center sm:mb-10">
        <Badge variant="neutral" appearance="outline" shape="pill">Good to know</Badge>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
          Frequently asked questions
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Clear answers about the audit, GitHub permissions, and how Arbor handles source code.
        </p>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {faqs.map((faq, index) => (
          <details key={faq.question} open={index === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left marker:hidden transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 sm:py-5 [&::-webkit-details-marker]:hidden">
              <h3 className="text-sm font-semibold text-foreground sm:text-base">{faq.question}</h3>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-5 sm:pb-5">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
