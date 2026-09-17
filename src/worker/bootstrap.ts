// Loads .env into process.env before any other worker module evaluates.
import fs from 'node:fs'
import path from 'node:path'

const envFile = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !(m[1] in process.env)) {
      let value = m[2]
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[m[1]] = value
    }
  }
}

export {}