import AjvDraft4, { type ErrorObject, type ValidateFunction } from 'ajv-draft-04'
import addFormats from 'ajv-formats'
import sarifSchema from './schemas/sarif-schema-2.1.0.json'

let cachedValidator: ValidateFunction | null = null

function getSarifValidator(): ValidateFunction {
  if (cachedValidator) return cachedValidator
  const ajv = new AjvDraft4({
    strict: false,
    allErrors: true,
  })
  addFormats(ajv)
  cachedValidator = ajv.compile(sarifSchema)
  return cachedValidator
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) return []
  return errors.map((err) => {
    const location = err.instancePath || '/'
    return `${location}: ${err.message ?? 'schema validation error'}`
  })
}

export function validateSarifLog(payload: unknown): {
  valid: boolean
  errors: string[]
} {
  const validate = getSarifValidator()
  const ok = Boolean(validate(payload))
  return {
    valid: ok,
    errors: ok ? [] : formatAjvErrors(validate.errors),
  }
}

export function assertValidSarifLog(payload: unknown): void {
  const result = validateSarifLog(payload)
  if (!result.valid) {
    throw new Error(`Invalid SARIF 2.1.0 output: ${result.errors.slice(0, 5).join('; ')}`)
  }
}
