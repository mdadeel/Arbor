'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Boxes,
  CheckCircle2,
  Code2,
  FileCode,
  GitBranch,
  GitCommit,
  Layers,
  Network,
  ShieldCheck,
  Zap,
} from 'lucide-react'

export function HeroPreviewCard() {
  const [activeTab, setActiveTab] = useState<'findings' | 'graph' | 'stack'>('findings')

  return (
    <div className="relative mx-auto w-full max-w-5xl text-left">
      {/* Ambient glow hot spots */}
      <div className="pointer-events-none absolute -top-10 -right-8 h-56 w-56 rounded-full bg-cyan-500/20 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-14 -left-8 h-56 w-56 rounded-full bg-emerald-500/20 blur-[90px]" />

      {/* Branded gradient frame */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

      <div className="relative rounded-2xl border border-border bg-card shadow-2xl transition-all duration-300 overflow-hidden">
        {/* Chrome Window Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
            <span className="ml-2 font-mono text-xs text-muted-foreground truncate">
              arbor audit — mdadeel/etuitionhub-frontend
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5 text-primary" /> main
            </span>
            <span className="flex items-center gap-1">
              <GitCommit className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" /> 2f27537
            </span>
            <span className="hidden sm:inline-block rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              30s AST pass
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Audit Score Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <span className="font-display text-2xl font-black">88</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    Repository Health Score: Excellent
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" /> Ready for Production
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Evaluated across 7 architectural dimensions · 82 components analyzed · 0 circular dependencies
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="font-mono text-xs text-muted-foreground bg-card px-3 py-1.5 rounded-lg border border-border">
                1,420 LOC · 4.8s parse
              </div>
              {/* Animated AST progress bar */}
              <div className="w-full sm:w-40 h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-primary"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, delay: 0.4, ease: 'easeInOut' }}
                />
              </div>
            </div>
          </div>

          {/* 7 Horizontal Subscores Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
            {[
              { label: 'Architecture', score: '85', tone: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Tech Debt', score: '92', tone: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Maintainability', score: '90', tone: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Dependencies', score: '82', tone: 'text-cyan-600 dark:text-cyan-400' },
              { label: 'Performance', score: '94', tone: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Security', score: '86', tone: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Doc Coverage', score: '80', tone: 'text-emerald-600 dark:text-emerald-400' },
            ].map(({ label, score, tone }) => (
              <div
                key={label}
                className="rounded-lg border border-border bg-muted/20 p-2.5 col-span-1"
              >
                <div className="text-[10px] text-muted-foreground uppercase font-medium">{label}</div>
                <div className={`font-mono font-bold ${tone} text-sm mt-1`}>{score}/100</div>
              </div>
            ))}
          </div>

          {/* Interactive Tabs inside Preview */}
          <div className="space-y-3 pt-2">
            <div className="flex border-b border-border text-xs font-medium -mb-px" role="tablist" aria-label="Audit preview tabs">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'findings'}
                onClick={() => setActiveTab('findings')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'findings'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Zap className="h-3.5 w-3.5" /> AST Findings
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'graph'}
                onClick={() => setActiveTab('graph')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'graph'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Network className="h-3.5 w-3.5" /> Architecture Graph
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'stack'}
                onClick={() => setActiveTab('stack')}
                className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'stack'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="h-3.5 w-3.5" /> Detected Stack
              </button>
            </div>

            {/* Tab 1: Findings */}
            {activeTab === 'findings' && (
              <div className="space-y-2.5 font-mono text-xs pt-1">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        OPTIMIZATION
                      </span>
                      <span className="text-foreground font-medium font-sans">
                        Next.js Dynamic Image optimization enabled
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-sans">
                      Zero unoptimized HTML image tags detected across UI components directory.
                    </p>
                  </div>
                  <span className="text-muted-foreground text-[11px] shrink-0 font-mono">
                    src/components/ui/logo.tsx:14
                  </span>
                </motion.div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        WARNING
                      </span>
                      <span className="text-foreground font-medium font-sans">
                        Large component LOC threshold (&gt;350 lines)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-sans">
                      Consider splitting view controller logic into subcomponents to maintain testability.
                    </p>
                  </div>
                  <span className="text-muted-foreground text-[11px] shrink-0 font-mono">
                    src/components/dashboard/project-report.tsx:382
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        CLEAN
                      </span>
                      <span className="text-foreground font-medium font-sans">
                        Zero circular imports in dependency tree
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-sans">
                      Clean unidirectional module boundary graph between routes, services, and utilities.
                    </p>
                  </div>
                  <span className="text-emerald-600 dark:text-emerald-400 text-[11px] shrink-0 font-bold">PASS</span>
                </div>
              </div>
            )}

            {/* Tab 2: Graph Simulation */}
            {activeTab === 'graph' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="relative rounded-lg border border-border bg-card p-6 flex flex-col items-center justify-center min-h-[180px] overflow-hidden"
              >
                <div className="pointer-events-none absolute -top-10 right-0 h-40 w-40 rounded-full bg-cyan-500/15 blur-[60px]" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-xs w-full max-w-md z-10">
                  <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                    <Code2 className="h-5 w-5 mx-auto text-cyan-600 dark:text-cyan-400 mb-1" />
                    <div className="font-semibold text-foreground">src/app/api</div>
                    <div className="text-[10px] text-muted-foreground">HTTP Handlers</div>
                  </div>
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                    <Layers className="h-5 w-5 mx-auto text-primary mb-1" />
                    <div className="font-semibold text-foreground">src/server</div>
                    <div className="text-[10px] text-muted-foreground">tRPC Services</div>
                  </div>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <Boxes className="h-5 w-5 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
                    <div className="font-semibold text-foreground">src/lib/prisma</div>
                    <div className="text-[10px] text-muted-foreground">Postgres Layer</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-4 font-mono text-center">
                  Directed Acyclic Graph (DAG) · 0 cycles · 100% layer isolation
                </div>
              </motion.div>
            )}

            {/* Tab 3: Detected Stack */}
            {activeTab === 'stack' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                {[
                  { icon: Zap, tone: 'text-primary', name: 'Next.js 14', sub: 'App Router & Server Actions' },
                  { icon: Code2, tone: 'text-cyan-600 dark:text-cyan-400', name: 'TypeScript 5.x', sub: 'Strict Mode enforced' },
                  { icon: FileCode, tone: 'text-emerald-600 dark:text-emerald-400', name: 'Prisma ORM', sub: 'PostgreSQL relational store' },
                  { icon: ShieldCheck, tone: 'text-amber-600 dark:text-amber-400', name: 'NextAuth.js', sub: 'GitHub OAuth & PAT' },
                  { icon: Boxes, tone: 'text-cyan-600 dark:text-cyan-400', name: 'BullMQ & Redis', sub: 'Background analysis worker' },
                  { icon: Network, tone: 'text-primary', name: 'React Flow', sub: 'Interactive module graph' },
                ].map(({ icon: Icon, tone, name, sub }) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
                  >
                    <Icon className={`h-4 w-4 ${tone} shrink-0`} />
                    <div>
                      <div className="font-semibold text-foreground">{name}</div>
                      <div className="text-[10px] text-muted-foreground">{sub}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}