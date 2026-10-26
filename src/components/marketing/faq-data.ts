export interface FaqItem {
  question: string
  answer: string
}

export const faqs: FaqItem[] = [
  {
    question: 'Does Arbor store or train on my private repository code?',
    answer:
      'Arbor uses a temporary working copy while an audit runs, then removes that copy when processing finishes. Audit reports contain derived results, not complete source files, and the core audit does not send source code to an AI model. Optional AI features run only if you add your own provider key; they then send finding details, or one selected source file for patch suggestions, to that provider. Audit time depends on repository size and processing conditions.'
  },
  {
    question: 'How does the audit work, and does it use AI?',
    answer:
      'The core audit parses source syntax with Babel AST tooling to map imports, exports, selected component structures, and dependencies, then applies explicit rule-based checks. It does not use a language model, so the same code and rule set give the same results. Those results are not a guarantee that every possible issue will be detected. Optional AI features are separate and stay off unless you add your own provider key.'
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
      'Every scored public repository gets a dynamic SVG badge at /api/badge/{project-id}. Copy the README badge from the project report and paste it into your README. Private repositories do not get public badges. Whenever a new analysis completes, the badge reflects the latest audit score.',
  },
]
