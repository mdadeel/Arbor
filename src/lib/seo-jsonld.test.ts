import { describe, it, expect } from 'vitest'
import { buildHomeJsonLd } from './seo-jsonld'
import { faqs } from '@/components/marketing/faq-data'
import { howItWorksSteps } from '@/components/marketing/product-sections'

interface JsonLdNode {
  '@type': string
  '@id'?: string
  publisher?: { '@id': string }
  mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }>
  step?: Array<{ position: number; name: string; text: string }>
}

const appUrl = 'https://arborgit.vercel.app'
const graph = () => buildHomeJsonLd(appUrl)['@graph'] as unknown as JsonLdNode[]

describe('buildHomeJsonLd', () => {
  it('declares WebSite, FAQPage and HowTo nodes', () => {
    expect(graph().map((node) => node['@type'])).toEqual(['WebSite', 'FAQPage', 'HowTo'])
  })

  it('mirrors every visible FAQ and how-it-works step', () => {
    const nodes = graph()
    const faqPage = nodes.find((node) => node['@type'] === 'FAQPage')
    const howTo = nodes.find((node) => node['@type'] === 'HowTo')

    expect(faqPage?.mainEntity).toHaveLength(faqs.length)
    expect(faqPage?.mainEntity?.[0].name).toBe(faqs[0].question)
    expect(faqPage?.mainEntity?.[0].acceptedAnswer.text).toBe(faqs[0].answer)
    expect(howTo?.step).toHaveLength(howItWorksSteps.length)
    expect(howTo?.step?.map((step) => step.position)).toEqual([1, 2, 3])
    expect(howTo?.step?.[0].text).toBe(howItWorksSteps[0].body)
  })

  it('points the WebSite publisher at the shared organization id', () => {
    const website = graph().find((node) => node['@type'] === 'WebSite')
    expect(website?.publisher).toEqual({ '@id': `${appUrl}/#organization` })
  })
})
