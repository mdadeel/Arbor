export interface FaqItem {
  question: string
  answer: string
}

export const faqs: FaqItem[] = [
  {
    question: 'Does Arbor store or train on my private repository code?',
    answer:
      'Arbor uses a temporary working copy while an audit runs, then removes that copy when processing finishes. Source files are not retained as part of the audit report or sent to a generative AI model. Audit time depends on repository size and processing conditions.'
  },
  {
    question: 'How does AST analysis work without AI or LLMs?',
    answer:
      'Arbor parses source syntax with Babel AST tooling to map imports, exports, selected component structures, and dependencies. The rule-based results are reproducible for the same code and rule set; they are not a guarantee that every possible issue will be detected.'
  },
  {
    question: 'What permissions does Arbor request from GitHub?',
    answer:
      'Arbor requests the GitHub access needed to identify and analyze the repositories you choose. Review the permissions shown in GitHub’s authorization screen before approving. Public repositories can also be analyzed without connecting a private repository.'
  },
  {
    question: 'How are repository health scores calculated?',
    answer:
      'Scores (0–100) cover six dimensions: Architecture, Tech Debt, Performance, Documentation, Security, and Design System. An overall score combines the applicable dimensions; design-system weighting is omitted for projects without UI components.',
  },
  {
    question: 'How do dynamic README shields badges work?',
    answer:
      'Every scored repository gets a dynamic SVG badge endpoint at /api/badge/[slug]. You can paste the generated Markdown into your repo README. Whenever a new analysis runs, the badge in your README automatically reflects the latest audit score.',
  },
]
