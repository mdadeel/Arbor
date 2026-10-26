import type { Metadata } from 'next'
import { LegalDocument, type LegalSection } from '@/components/marketing/legal-document'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Arbor handles your GitHub account data, repository analysis results, temporary working copies, and optional AI provider keys.',
  alternates: { canonical: '/privacy' },
}

const sections: LegalSection[] = [
  {
    id: 'scope',
    heading: 'What this policy covers',
    paragraphs: [
      'This policy explains what Arbor collects when you use the Arbor website and analysis service, how that data is used, and the choices you have. It does not cover third-party services you choose to connect, such as GitHub or an AI provider, which have their own privacy policies.',
    ],
  },
  {
    id: 'collected',
    heading: 'Information we collect',
    paragraphs: ['Depending on how you use Arbor, we store:'],
    items: [
      'Account details returned by GitHub when you sign in: username, display name, email address, avatar, and GitHub account ID.',
      'GitHub access granted through OAuth. Arbor requests the read:user, user:email, and repo scopes. Access tokens are encrypted at rest with AES-256-GCM.',
      'Repository metadata: repository name, URL, default branch, visibility, and the projects you connect.',
      'Analysis results: scores, module structure, dependency relationships, and findings with file paths and line numbers.',
      'Environment documentation: variable names and their documentation status. Arbor does not store environment variable values.',
      'Content you create in Arbor, such as living documentation, its version history, and imported API specifications.',
      'Email addresses you submit to the Teams waitlist.',
      'Audit log entries for account and project actions, used for security and troubleshooting.',
    ],
  },
  {
    id: 'working-copies',
    heading: 'Temporary working copies',
    paragraphs: [
      'To analyze a repository, Arbor clones it into temporary storage on the analysis server. The working copy is deleted when processing finishes, whether it succeeds or fails. Stored reports contain derived results, such as scores, structure, and findings, rather than complete source files.',
    ],
  },
  {
    id: 'ai-providers',
    heading: 'Optional AI features and provider keys',
    paragraphs: [
      'The core audit is rule-based and does not send source code to an AI service. AI features are optional and only run if you add your own OpenAI or Anthropic API key. Your key is encrypted at rest. When you use an AI feature:',
    ],
    items: [
      'Finding explanations send the finding details to your chosen provider: the title, description, recommendation, file path, and line number.',
      'Patch suggestions send the contents of one source file you select, up to 64 KB, to your chosen provider.',
      'Your provider processes that data under its own terms and retention settings.',
    ],
  },
  {
    id: 'public-surfaces',
    heading: 'Public badges and shared reports',
    paragraphs: [
      'Badges are public. For a public repository, the badge image shows its overall score to anyone who loads it, and the badge URL can be embedded in a README. Badges are not shown for private repositories. Shared report links let anyone with the link read that report until you revoke the link.',
    ],
  },
  {
    id: 'use',
    heading: 'How we use information',
    paragraphs: [
      'We use this information to run analyses, show reports and badges, keep accounts secure, respond to support requests, send service emails, and contact waitlist members about Teams when they ask to hear about it. We do not sell personal information, and we do not use repository content to train AI models.',
    ],
  },
  {
    id: 'sharing',
    heading: 'Who we share information with',
    paragraphs: [
      'We share information only with service providers that run Arbor for us, and with providers you choose to connect. These include hosting and database infrastructure, GitHub (to read the repositories you authorize), an email delivery provider for service emails, and the AI provider you configure, if you use AI features. We may also disclose information when required by law.',
    ],
  },
  {
    id: 'retention',
    heading: 'How long we keep information',
    paragraphs: [
      'Working copies are deleted when each analysis finishes. Account data, projects, and reports are kept while your account is active. We do not yet offer self-service account deletion. Administrators delete accounts on request, and the request process is described in the section on your choices.',
    ],
  },
  {
    id: 'choices',
    heading: 'Your choices',
    paragraphs: [
      'You can revoke Arbor’s GitHub access at any time from your GitHub settings under Applications. You can revoke a shared report link from within Arbor. To request access to, correction of, or deletion of your data, open an issue at github.com/mdadeel/Arbor/issues and label it as a privacy request. Do not include personal data, tokens, or secrets in the public issue; we will follow up through GitHub.',
    ],
  },
  {
    id: 'security',
    heading: 'Security',
    paragraphs: [
      'We encrypt stored GitHub tokens and provider keys, restrict access to project data to the people who are allowed to view it, and rate-limit analysis requests. No online service can guarantee absolute security, so please protect your GitHub account with strong authentication.',
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    paragraphs: [
      'When we change this policy, we will update the effective date at the top of this page. Material changes will be announced in the product.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      intro="This page explains what Arbor stores when you connect GitHub repositories, how analysis works with temporary working copies, and how optional AI features handle your data."
      sections={sections}
    />
  )
}
