import type { Metadata } from 'next'
import { LegalDocument, type LegalSection } from '@/components/marketing/legal-document'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms for using Arbor to analyze GitHub repositories, including what audits do and do not guarantee.',
  alternates: { canonical: '/terms' },
}

const sections: LegalSection[] = [
  {
    id: 'agreement',
    heading: 'Agreement to these terms',
    paragraphs: [
      'By creating an account or using Arbor, you agree to these terms. If you use Arbor for a team or organization, you confirm that you are allowed to accept these terms on its behalf. If you do not agree, do not use Arbor.',
    ],
  },
  {
    id: 'service',
    heading: 'What Arbor provides',
    paragraphs: [
      'Arbor analyzes GitHub repositories you connect and produces an architecture map, dependency graph, health scores, and findings. Audits use deterministic AST parsing and explicit static checks. They cover only the checks Arbor implements, so they can miss issues and can report issues that are not real. Audits are a starting point for review. They do not replace code review, security testing, or professional advice.',
    ],
  },
  {
    id: 'accounts',
    heading: 'Accounts and GitHub access',
    paragraphs: [
      'You sign in with GitHub. You are responsible for your account and for any activity under it. Arbor requests the GitHub scopes described in our Privacy Policy. You must have the right to access any repository you connect, and you must keep your GitHub credentials confidential.',
    ],
  },
  {
    id: 'acceptable-use',
    heading: 'Acceptable use',
    paragraphs: ['You agree not to:'],
    items: [
      'Analyze repositories you are not authorized to access, or use Arbor to gather information about others without permission.',
      'Attempt to bypass rate limits, access controls, or the analysis safeguards, or interfere with the service or other users.',
      'Use Arbor to build a competing service by systematically extracting its data, or to resell access to it without permission.',
      'Upload or submit content that is unlawful or that infringes someone else’s rights.',
    ],
  },
  {
    id: 'plans',
    heading: 'Plans, limits, and waitlist',
    paragraphs: [
      'The Community plan is free. Each account can run up to 10 audits per hour across all of its repositories. Limits may change, and we will tell you in advance when a change affects existing use. Teams features are in development and are not available yet. Joining the waitlist does not commit you to a purchase, and we do not promise a launch date or pricing.',
    ],
  },
  {
    id: 'your-content',
    heading: 'Your content',
    paragraphs: [
      'You keep ownership of your repositories, documentation, and other content. You give Arbor permission to process that content only as needed to provide the service to you, such as cloning a repository for an audit and storing the resulting report. Arbor deletes temporary working copies when processing finishes.',
    ],
  },
  {
    id: 'third-parties',
    heading: 'Third-party services',
    paragraphs: [
      'Arbor relies on third parties, including GitHub and, if you enable it, an AI provider you supply a key for. Their terms and availability apply to your use of them. Arbor is not responsible for third-party services.',
    ],
  },
  {
    id: 'availability',
    heading: 'Availability and changes',
    paragraphs: [
      'We work to keep Arbor available, but we do not guarantee uninterrupted or error-free service. We may change, suspend, or discontinue features. Where practical, we will give notice before a change that materially reduces what you rely on.',
    ],
  },
  {
    id: 'disclaimers',
    heading: 'Disclaimers',
    paragraphs: [
      'Arbor is provided “as is” and “as available.” To the fullest extent permitted by law, we disclaim all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.',
    ],
  },
  {
    id: 'liability',
    heading: 'Limitation of liability',
    paragraphs: [
      'To the fullest extent permitted by law, Arbor is not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill arising from your use of the service. Our total liability for any claim relating to the service is limited to the amount you paid us for the service in the 12 months before the claim, or zero if you paid nothing.',
    ],
  },
  {
    id: 'termination',
    heading: 'Ending your use',
    paragraphs: [
      'You can stop using Arbor at any time and revoke its GitHub access from your GitHub settings. We may suspend or terminate accounts that violate these terms or put the service or other users at risk. Sections that by their nature should survive termination will survive it.',
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to these terms',
    paragraphs: [
      'We may update these terms. We will change the effective date at the top of this page and announce material changes in the product. Continuing to use Arbor after a change takes effect means you accept the updated terms.',
    ],
  },
  {
    id: 'contact',
    heading: 'Contact',
    paragraphs: [
      'Questions about these terms can be sent by opening an issue at github.com/mdadeel/Arbor/issues. Do not include personal data or secrets in public issues.',
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      intro="These terms govern your use of Arbor, including what the audits do and do not guarantee, the free plan’s limits, and how your content is handled."
      sections={sections}
    />
  )
}
