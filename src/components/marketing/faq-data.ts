export interface FaqItem {
  question: string
  answer: string
}

export const faqs: FaqItem[] = [
  {
    question: 'Does Arbor store or train on my private repository code?',
    answer:
      'Absolutely not. Arbor performs shallow Git clones into an ephemeral directory in memory/temp storage. As soon as the AST parser completes its evaluation (~30 seconds), the clone directory is completely deleted. No source code is ever retained or fed to any model.',
  },
  {
    question: 'How does AST analysis work without AI or LLMs?',
    answer:
      'Arbor uses deterministic Babel AST (Abstract Syntax Tree) parsers. It evaluates real syntax nodes—imports, exports, component structures, hook lifecycles, and dependency graphs. Unlike LLMs which hallucinate and have slow token latency, our AST results are 100% deterministic, repeatable, and complete in seconds.',
  },
  {
    question: 'What permissions does Arbor request from GitHub?',
    answer:
      'Arbor asks for standard read-only user profile information and repository access to clone and analyze code. For public repositories, unauthenticated access is supported with zero token friction. For enterprise setups with SAML/SSO, you can also supply fine-grained Personal Access Tokens (PAT).',
  },
  {
    question: 'How are repository health scores calculated?',
    answer:
      'Scores (0–100) are computed across 7 distinct dimensions: Architecture & Layer Isolation, Tech Debt & Large Files, Maintainability, Dependency Health, Runtime/Bundle Performance, Security & Secret Audits, and Documentation Coverage.',
  },
  {
    question: 'How do dynamic README shields badges work?',
    answer:
      'Every scored repository gets a dynamic SVG badge endpoint at /api/badge/[slug]. You can paste the generated Markdown into your repo README. Whenever a new analysis runs, the badge in your README automatically reflects the latest audit score.',
  },
]
