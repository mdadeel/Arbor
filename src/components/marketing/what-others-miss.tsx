'use client'

import { Check, FileCode2, GitBranch, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/createui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/createui/tabs'

const EXAMPLES = [
  {
    id: 'cycle',
    tab: 'Dependency cycle',
    category: 'Architecture',
    title: 'A circular import crosses two modules',
    file: 'src/routes/orders.ts',
    mechanism: 'Resolved AST import graph',
    explanation: 'The import path closes a cycle: orders → billing → orders.',
    code: [
      'import { invoiceFor } from "../billing/invoices"',
      'export const ordersRouter = createRouter({',
      '  invoice: () => invoiceFor(orderId),',
      '})',
      '// billing/invoices.ts imports ordersRouter',
    ],
  },
  {
    id: 'secret',
    tab: 'Secret pattern',
    category: 'Security',
    title: 'A credential-like value needs a second look',
    file: 'src/config.ts',
    mechanism: 'Static secret-pattern scan',
    explanation: 'The value is redacted in the report; the detector records the file and rule, not the credential.',
    code: [
      'export const config = {',
      '  // Example value redacted by the scanner',
      '  accessToken: "[redacted]",',
      '}',
    ],
  },
  {
    id: 'guard',
    tab: 'Route protection',
    category: 'Access control',
    title: 'An administrative route lacks its expected guard',
    file: 'src/server/admin.ts',
    mechanism: 'Procedure and middleware check',
    explanation: 'The report points to the route declaration so a developer can verify the intended access policy.',
    code: [
      'export const purge = publicProcedure',
      '  .mutation(async ({ ctx }) => {',
      '    return purgeOldRuns(ctx.db)',
      '  })',
    ],
  },
]

export function WhatOthersMiss() {
  return (
    <section id="security" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start lg:gap-12">
        <div className="space-y-5">
          <Badge variant="verified" appearance="soft" leading={<ShieldCheck aria-hidden="true" />}>
            Evidence-backed findings
          </Badge>
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground text-balance sm:text-4xl">
            Every finding comes with a reason you can inspect.
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Arbor connects a result to the file, relationship, or rule that produced it. Start with the signal, then check the evidence before deciding what to change.
          </p>

          <ul className="space-y-3 border-t border-border pt-5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <GitBranch className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>Follow dependency paths instead of reading isolated files.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>See which deterministic check raised a security or access-control flag.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <FileCode2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>Review the source location before sharing or acting on a result.</span>
            </li>
          </ul>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/25 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Finding inspector</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Example output · sample repository</p>
            </div>
            <Badge variant="neutral" appearance="outline" size="xs">Illustrative</Badge>
          </div>

          <div className="p-4 sm:p-5">
            <Tabs defaultValue="cycle">
              <TabsList aria-label="Choose an example audit finding">
                {EXAMPLES.map((example) => (
                  <TabsTrigger key={example.id} value={example.id}>
                    {example.tab}
                  </TabsTrigger>
                ))}
              </TabsList>

              {EXAMPLES.map((example) => (
                <TabsContent key={example.id} value={example.id}>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground sm:text-base">{example.title}</h3>
                        <code className="mt-1 block break-all text-xs text-muted-foreground">{example.file}</code>
                      </div>
                      <Badge variant="warning" appearance="soft" size="xs">{example.category}</Badge>
                    </div>

                    <div className="grid min-w-0 gap-4 md:grid-cols-[0.78fr_1.22fr]">
                      <div className="rounded-xl border border-border bg-muted/25 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Detection method</p>
                        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                          {example.mechanism}
                        </p>
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{example.explanation}</p>
                      </div>

                      <pre className="min-w-0 overflow-x-auto rounded-xl border border-border bg-[#111713] p-4 text-[11px] leading-6 text-neutral-200 sm:text-xs" aria-label={`Illustrative code excerpt from ${example.file}`}>
                        <code>
                          {example.code.map((line, index) => (
                            <span key={`${example.id}-${index}`} className="block whitespace-pre">
                              <span className="mr-3 inline-block w-4 select-none text-right text-neutral-500">{index + 1}</span>
                              {line}
                            </span>
                          ))}
                        </code>
                      </pre>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="border-t border-border bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5">
            Examples are illustrative. Arbor generates each finding from the connected repository and shows the evidence available for that check.
          </div>
        </div>
      </div>
    </section>
  )
}
