import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import bomSchema from './schemas/cyclonedx/bom-1.5.schema.json'
import jsfSchema from './schemas/cyclonedx/jsf-0.82.schema.json'
import spdxSchema from './schemas/cyclonedx/spdx.schema.json'

const SPDX_LICENSE_IDS: ReadonlySet<string> = new Set(
  Array.isArray(spdxSchema.enum) ? spdxSchema.enum : []
)

// RFC 3987 / RFC 6531 validation for optional JSON Schema draft-07 IRI & IDN formats
// referenced inside official CycloneDX 1.5 schema definitions.
const IRI_REFERENCE_RE = /^[^\s<>"{}|\\^`]*$/
const IDN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

let cachedValidator: ValidateFunction | null = null

export function isOfficialSpdxLicenseId(value: string): boolean {
  return SPDX_LICENSE_IDS.has(value)
}

function getCycloneDxValidator(): ValidateFunction {
  if (cachedValidator) return cachedValidator

  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    schemas: [spdxSchema, jsfSchema],
  })
  addFormats(ajv)
  ajv.addFormat('iri-reference', {
    type: 'string',
    validate: (value: string) => IRI_REFERENCE_RE.test(value),
  })
  ajv.addFormat('idn-email', {
    type: 'string',
    validate: (value: string) => IDN_EMAIL_RE.test(value),
  })

  cachedValidator = ajv.compile(bomSchema)
  return cachedValidator
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) return []
  return errors.map((err) => {
    const location = err.instancePath || '/'
    return `${location}: ${err.message ?? 'CycloneDX 1.5 schema validation error'}`
  })
}

type JsonRecord = Record<string, unknown>

function isExternalBomLink(ref: string): boolean {
  return ref.startsWith('urn:cdx:')
}

/**
 * Verifies cross-document `bom-ref` uniqueness and referential integrity rules
 * required by the CycloneDX 1.5 specification beyond JSON Schema structural rules.
 */
function checkReferentialIntegrity(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const root = payload as JsonRecord
  const errors: string[] = []
  const declaredRefs = new Set<string>()

  const registerComponentRefs = (node: unknown, pathPrefix: string) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const record = node as JsonRecord
    if (typeof record['bom-ref'] === 'string' && record['bom-ref'].length > 0) {
      const ref = record['bom-ref']
      if (declaredRefs.has(ref)) {
        errors.push(`${pathPrefix}/bom-ref: duplicate bom-ref "${ref}" within BOM`)
      } else {
        declaredRefs.add(ref)
      }
    }
    if (Array.isArray(record.components)) {
      record.components.forEach((child, idx) =>
        registerComponentRefs(child, `${pathPrefix}/components/${idx}`)
      )
    }
  }

  if (root.metadata && typeof root.metadata === 'object' && !Array.isArray(root.metadata)) {
    const metadata = root.metadata as JsonRecord
    if (metadata.component) {
      registerComponentRefs(metadata.component, '/metadata/component')
    }
  }

  if (Array.isArray(root.components)) {
    root.components.forEach((comp, idx) => registerComponentRefs(comp, `/components/${idx}`))
  }

  if (Array.isArray(root.services)) {
    root.services.forEach((svc, idx) => registerComponentRefs(svc, `/services/${idx}`))
  }

  if (Array.isArray(root.vulnerabilities)) {
    root.vulnerabilities.forEach((rawVuln, vIdx) => {
      if (!rawVuln || typeof rawVuln !== 'object' || Array.isArray(rawVuln)) return
      const vuln = rawVuln as JsonRecord
      if (!Array.isArray(vuln.affects)) return
      vuln.affects.forEach((rawAffect, aIdx) => {
        if (!rawAffect || typeof rawAffect !== 'object' || Array.isArray(rawAffect)) return
        const ref = (rawAffect as JsonRecord).ref
        if (
          typeof ref === 'string' &&
          !isExternalBomLink(ref) &&
          !declaredRefs.has(ref)
        ) {
          errors.push(
            `/vulnerabilities/${vIdx}/affects/${aIdx}/ref: references unknown component bom-ref "${ref}"`
          )
        }
      })
    })
  }

  if (Array.isArray(root.dependencies)) {
    root.dependencies.forEach((rawDep, dIdx) => {
      if (!rawDep || typeof rawDep !== 'object' || Array.isArray(rawDep)) return
      const dep = rawDep as JsonRecord
      if (
        typeof dep.ref === 'string' &&
        !isExternalBomLink(dep.ref) &&
        !declaredRefs.has(dep.ref)
      ) {
        errors.push(`/dependencies/${dIdx}/ref: references unknown bom-ref "${dep.ref}"`)
      }
      if (Array.isArray(dep.dependsOn)) {
        dep.dependsOn.forEach((target, tIdx) => {
          if (
            typeof target === 'string' &&
            !isExternalBomLink(target) &&
            !declaredRefs.has(target)
          ) {
            errors.push(
              `/dependencies/${dIdx}/dependsOn/${tIdx}: references unknown bom-ref "${target}"`
            )
          }
        })
      }
    })
  }

  return errors
}

export function validateCycloneDx15Sbom(payload: unknown): {
  valid: boolean
  errors: string[]
} {
  const validate = getCycloneDxValidator()
  const schemaOk = Boolean(validate(payload))
  const schemaErrors = schemaOk ? [] : formatAjvErrors(validate.errors)
  const integrityErrors = checkReferentialIntegrity(payload)
  const errors = [...schemaErrors, ...integrityErrors]

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function assertValidCycloneDxSbom(payload: unknown): void {
  const result = validateCycloneDx15Sbom(payload)
  if (!result.valid) {
    throw new Error(
      `Generated CycloneDX 1.5 SBOM failed official schema validation: ${result.errors
        .slice(0, 5)
        .join('; ')}`
    )
  }
}
