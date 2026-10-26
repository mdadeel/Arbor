export interface FaqItem {
  question: string
  answer: string
}

export const faqs: FaqItem[] = [
  {
    question: 'Does Arbor store or train on my private repository code?',
    answer:
      'Arbor clones the repository into a temporary working copy for the duration of an audit and deletes that copy when processing finishes. Saved reports contain derived results, such as import graphs, scores, and finding locations, rather than complete source files. The core audit does not send source code to an AI model. AI features are optional and stay off unless you add your own OpenAI or Anthropic key. When you use them, finding details are sent to that provider, and patch suggestions also send one selected source file. Your data is handled under that provider’s terms. Audit time depends on repository size and processing conditions.',
  },
  {
    question: 'How does the audit work, and does it use AI?',
    answer:
      'The core audit parses JavaScript and TypeScript source with Babel AST tooling to map local imports, exports, selected component structures, and dependencies, then applies explicit rule-based checks. It does not use a language model, so the same code and rule set give the same results. Those results are not a guarantee that every possible issue will be detected. Optional AI features are separate and stay off unless you add your own provider key.',
  },
  {
    question: 'What permissions does Arbor request from GitHub?',
    answer:
      'Arbor asks GitHub for the read:user, user:email, and repo scopes. The repo scope is broad: GitHub uses it for private repositories, and it can also allow write actions. Arbor uses it to read repository contents for audits. The current code does not create commits or pull requests. Review GitHub’s authorization screen before approving. Public repositories can also be analyzed without connecting a private repository.',
  },
  {
    question: 'How are repository health scores calculated?',
    answer:
      'Scores (0–100) cover six dimensions: Architecture, Tech Debt, Performance, Documentation, Security, and Design System. An overall score combines the applicable dimensions; design-system weighting is omitted for projects without UI components.',
  },
  {
    question: 'How do dynamic README shields badges work?',
    answer:
      'Public repositories with a completed audit get a dynamic SVG badge at /api/badge/{project-id}. Copy the badge Markdown from the project report and paste it into your README. Private repositories do not get public badges. When a new analysis completes, the badge shows the latest score.',
  },
]
