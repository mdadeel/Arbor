'use client'

import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { faqs, type FaqItem } from './faq-data'

export { faqs, type FaqItem }

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 scroll-mt-24">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-display">
          Frequently Asked Questions
        </h2>
        <p className="text-base text-muted-foreground max-w-xl mx-auto">
          Clear answers about security, GitHub permissions, and the AST engine.
        </p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx
          return (
            <div
              key={idx}
              className="rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-colors"
            >
<button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between py-4 px-5 text-left text-sm sm:text-base font-semibold text-foreground hover:bg-muted/30 transition-colors"
                  aria-expanded={isOpen}
                >
                  <h3 className="pr-4 font-display text-base sm:text-lg font-semibold tracking-tight text-foreground">
                    {faq.question}
                  </h3>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-primary' : ''
                    }`}
                  />
                </button>
              {isOpen && (
                <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/60">
                  {faq.answer}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
