import { faqs } from '@/components/marketing/faq-data'
import { howItWorksSteps } from '@/components/marketing/product-sections'

/**
 * Homepage JSON-LD derived from the same data the page renders, so the markup
 * cannot drift from the visible FAQ and how-it-works copy.
 */
export function buildHomeJsonLd(appUrl: string) {
  const organizationId = `${appUrl}/#organization`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${appUrl}/#website`,
        url: appUrl,
        name: 'Arbor',
        inLanguage: 'en',
        publisher: { '@id': organizationId },
      },
      {
        '@type': 'FAQPage',
        '@id': `${appUrl}/#faq`,
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
      {
        '@type': 'HowTo',
        '@id': `${appUrl}/#how-it-works`,
        name: 'From a repo you own to a map you can inspect',
        step: howItWorksSteps.map((step) => ({
          '@type': 'HowToStep',
          position: Number(step.number),
          name: step.title,
          text: step.body,
        })),
      },
    ],
  }
}
