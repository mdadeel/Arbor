import type { Finding, FindingCategory } from './types'

type Guidance = Pick<Finding, 'explanation' | 'impact' | 'recommendation' | 'confidence'>

const CATEGORY_GUIDANCE: Record<FindingCategory, Guidance> = {
  security: {
    explanation: 'This is a static pattern match in repository text. Arbor does not verify whether the value is live, reachable, or exploitable.',
    impact: 'If the signal is a real credential or unsafe flow, an attacker may gain access or expose sensitive data.',
    recommendation: 'Verify the referenced code, rotate any real credential, and keep secrets in a managed runtime secret store.',
    confidence: 'medium',
  },
  structure: {
    explanation: 'This heuristic is based on repository layout and recognized file names; projects may intentionally use a different structure.',
    impact: 'Unclear boundaries can make ownership, onboarding, and change impact harder to understand.',
    recommendation: 'Treat this as a review prompt and document or organize boundaries where the team is experiencing friction.',
    confidence: 'medium',
  },
  techDebt: {
    explanation: 'This signal is derived from static source/import data and is not a substitute for runtime or team-context review.',
    impact: 'Confirmed issues can make changes riskier, increase maintenance cost, or hide accidental complexity.',
    recommendation: 'Start with the exact evidence below; make small changes and validate with the project test suite.',
    confidence: 'medium',
  },
  performance: {
    explanation: 'This is a source-level performance hint. Arbor does not run a production build, browser trace, or load test.',
    impact: 'If confirmed in a hot path, the pattern may increase browser work, network transfer, or render time.',
    recommendation: 'Measure the affected route/component first, then optimize only where a real user-facing cost is observed.',
    confidence: 'low',
  },
  documentation: {
    explanation: 'This check looks for common documentation artifacts and comment patterns; it cannot judge documentation quality.',
    impact: 'Missing onboarding or decision context can slow contributors and make operational tasks error-prone.',
    recommendation: 'Document the project setup, important workflows, and non-obvious architectural decisions.',
    confidence: 'medium',
  },
  environment: {
    explanation: 'This check compares statically discovered environment references with the repository example file.',
    impact: 'Undocumented configuration can cause deployment drift or make local setup fail.',
    recommendation: 'Document variable names and safe example values; never add production secrets to the example file.',
    confidence: 'medium',
  },
  designSystem: {
    explanation: 'This heuristic scans likely UI/component and theme files; repository conventions can differ from Arbor’s detection rules.',
    impact: 'Inconsistent tokens or component patterns can increase visual drift and make re-theming harder.',
    recommendation: 'Adopt shared tokens and component conventions where they help the product remain consistent.',
    confidence: 'low',
  },
  accessibility: {
    explanation: 'This is a static JSX/HTML heuristic. It does not evaluate rendered accessibility trees, localization, or context-dependent accessible names.',
    impact: 'Missing accessible names can make controls and images difficult or impossible to understand with assistive technology.',
    recommendation: 'Inspect the rendered component and add meaningful alt text or an accessible name; use empty alt text only for decorative imagery.',
    confidence: 'medium',
  },
  analysis: {
    explanation: 'Arbor stopped or skipped part of the repository scan to respect configured safety and runtime limits.',
    impact: 'Scores and findings may not represent files that were skipped; absence of a finding is not evidence that the skipped area is clean.',
    recommendation: 'Review the coverage details and raise limits only if the worker has sufficient CPU, memory, and disk capacity.',
    confidence: 'high',
  },
}

const FINDING_GUIDANCE: Record<string, Partial<Guidance>> = {
  'unused-deps': {
    explanation: 'No exact package import or recognized script reference was found in the parsed files. Dynamic loading, generated code, plugins, or workspace tooling may still use it.',
    impact: 'A confirmed unused dependency can increase install time, attack surface, and maintenance overhead.',
    recommendation: 'Search the full repository and build configuration before removing it; then run tests and production build.',
    confidence: 'low',
  },
  'dead-exports': {
    explanation: 'The export name was not found among statically parsed imports. Public package APIs, framework conventions, reflection, and dynamic imports can make this a false positive.',
    impact: 'Truly unreachable exports add maintenance surface, but removing a public API can break downstream consumers.',
    recommendation: 'Check package entry points and framework conventions before removing the export.',
    confidence: 'low',
  },
  'circular-dep': {
    explanation: 'A cycle was found in statically resolved local imports. The graph does not model every runtime loading mechanism.',
    impact: 'Some cycles can create initialization-order surprises or make module boundaries harder to reason about; many are harmless.',
    recommendation: 'Inspect the listed path and consider extracting shared types or utilities if the cycle is causing real coupling.',
    confidence: 'medium',
  },
  'client-heavy': {
    explanation: 'The ratio counts React files with a top-level “use client” directive, not bundle bytes or rendered routes.',
    impact: 'A large client surface can increase JavaScript transfer and hydration work, but the ratio alone does not prove a slowdown.',
    recommendation: 'Use browser/build measurements to identify expensive client boundaries; keep interactive state client-side and move static work server-side.',
    confidence: 'low',
  },
  'a11y-img-alt': {
    explanation: 'The image element has no statically detectable alt attribute. Dynamic JSX spreads may provide one at runtime.',
    impact: 'Screen-reader users may not receive the visual information conveyed by a non-decorative image.',
    recommendation: 'Add concise, context-appropriate alt text, or explicitly use alt="" for a decorative image.',
    confidence: 'high',
  },
  'a11y-button-name': {
    explanation: 'The button has no obvious text or accessible-name attribute in its source markup; component wrappers can provide names indirectly.',
    impact: 'Assistive technology may expose the control as an unnamed button, making its purpose unclear.',
    recommendation: 'Provide visible text or an aria-label/aria-labelledby that describes the action, then verify the rendered accessibility tree.',
    confidence: 'low',
  },
  'analysis-coverage': {
    explanation: 'Coverage metadata lists file-count, file-size, parser, and time budgets that constrained this run.',
    impact: 'Metrics and scores describe only the portion that Arbor inspected.',
    recommendation: 'Use the reported limits to decide whether to split the repository or safely increase a configured budget.',
    confidence: 'high',
  },
}

export function enrichFinding(finding: Finding): Finding {
  const categoryGuidance = CATEGORY_GUIDANCE[finding.category]
  const specificGuidance = FINDING_GUIDANCE[finding.ruleId ?? finding.id] ?? {}
  const evidence = finding.evidence ?? (finding.file ? [`${finding.file}${finding.line ? `:${finding.line}` : ''}`] : undefined)

  return {
    ...categoryGuidance,
    ...specificGuidance,
    ...finding,
    evidence,
  }
}
