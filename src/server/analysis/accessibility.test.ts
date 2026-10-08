import { describe, expect, it } from 'vitest'
import { accessibilityFindings } from './checks'

describe('source-level accessibility checks', () => {
  it('reports non-decorative images without alt text with stable rule metadata', () => {
    const findings = accessibilityFindings('<img src="/hero.png">\n<img src="/divider.svg" role="presentation">', 'src/view.tsx')
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      ruleId: 'a11y-img-alt',
      category: 'accessibility',
      file: 'src/view.tsx',
      line: 1,
      confidence: 'high',
    })
  })

  it('does not report labelled images or textual/labelled buttons', () => {
    const findings = accessibilityFindings([
      '<img src="/portrait.png" alt="A person smiling">',
      '<button>Save changes</button>',
      '<button aria-label="Close"><Icon /></button>',
      '<button><Icon /></button>',
    ].join('\n'), 'src/actions.tsx')
    expect(findings.map((finding) => finding.ruleId)).toEqual(['a11y-button-name'])
    expect(findings[0].line).toBe(4)
  })
})
