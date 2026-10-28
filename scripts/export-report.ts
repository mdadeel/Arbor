import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

type CliOptions = {
  token: string
  outPath: string | null
  baseUrl: string
}

function printUsage(): void {
  console.log(
    [
      'Usage: npm run report:pdf -- <share-token> [--out <output.pdf>] [--base-url <url>]',
      '',
      'Options:',
      '  <share-token>       43-character read-only share token created in Arbor',
      '  --out <path>        Destination PDF file path (default: ./arbor-audit-<repo>-<sha>.pdf)',
      '  --base-url <url>    Running Arbor base URL (default: APP_URL or http://localhost:3000)',
    ].join('\n')
  )
}

function parseCliArgs(argv: string[]): CliOptions {
  let token = ''
  let outPath: string | null = null
  let baseUrl = process.env.REPORT_BASE_URL || process.env.APP_URL || 'http://localhost:3000'

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg) continue
    if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    } else if (arg === '--out' || arg === '-o') {
      const next = argv[i + 1]
      if (!next) {
        throw new Error('Missing file path after --out')
      }
      outPath = next
      i += 1
    } else if (arg.startsWith('--out=')) {
      outPath = arg.slice('--out='.length)
    } else if (arg === '--base-url') {
      const next = argv[i + 1]
      if (!next) {
        throw new Error('Missing URL after --base-url')
      }
      baseUrl = next
      i += 1
    } else if (arg.startsWith('--base-url=')) {
      baseUrl = arg.slice('--base-url='.length)
    } else if (!arg.startsWith('-') && !token) {
      token = arg.trim()
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }

  if (!token) {
    printUsage()
    throw new Error('A valid 43-character share token is required.')
  }

  if (!SHARE_TOKEN_PATTERN.test(token)) {
    throw new Error(
      'Malformed share token: expected a 43-character base64url token from a report share link.'
    )
  }

  return { token, outPath, baseUrl: baseUrl.replace(/\/+$/, '') }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function slugifyFileSegment(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'repository'
  )
}

function buildFooterTemplate(meta: {
  repoName: string
  commitSha: string
  branch: string
  scanDate: string
}): string {
  const shortSha = meta.commitSha === 'unpinned' ? 'unpinned' : meta.commitSha.slice(0, 12)
  const shortDate = meta.scanDate.slice(0, 10)
  const leftText = escapeHtml(
    `Arbor · ${meta.repoName} · commit ${shortSha} (${meta.branch}) · ${shortDate} — stale if HEAD advances`
  )

  return `
    <div style="
      width: 100%;
      margin: 0 14mm;
      padding-top: 4px;
      border-top: 0.5px solid #e5ebe6;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 7px;
      line-height: 1.2;
      color: #97a39b;
      -webkit-print-color-adjust: exact;
    ">
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 85%;">${leftText}</span>
      <span style="font-family: Inter, system-ui, -apple-system, sans-serif; font-size: 7.5px; color: #6e7b72; white-space: nowrap;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </span>
    </div>
  `
}

async function main(): Promise<void> {
  const { token, outPath, baseUrl } = parseCliArgs(process.argv.slice(2))
  const reportUrl = `${baseUrl}/report/${encodeURIComponent(token)}`

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined

  const extraArgs = process.env.PLAYWRIGHT_CHROMIUM_ARGS
    ? process.env.PLAYWRIGHT_CHROMIUM_ARGS.split(/\s+/).filter(Boolean)
    : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: extraArgs,
  })

  try {
    const context = await browser.newContext({
      viewport: { width: 1240, height: 1754 },
    })
    const page = await context.newPage()

    const response = await page.goto(reportUrl, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })

    if (!response) {
      throw new Error(`No HTTP response received from ${reportUrl}`)
    }

    const status = response.status()
    if (status === 404) {
      throw new Error(
        `Report share token rejected with HTTP 404 at ${reportUrl} (token may be invalid, expired, or revoked).`
      )
    }
    if (status >= 400) {
      throw new Error(`Failed to load ${reportUrl}: HTTP ${status}`)
    }

    await page.waitForSelector('#arbor-print-report', { timeout: 15_000 })
    await page.evaluate(async () => {
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
      document.documentElement.style.backgroundColor = '#ffffff'
      document.body.style.backgroundColor = '#ffffff'
      document.documentElement.setAttribute('data-pdf-exporter', 'playwright')
      if ('fonts' in document) {
        await document.fonts.ready
      }
    })

    const meta = await page.evaluate(() => {
      const root = document.getElementById('arbor-print-report')
      return {
        repoName: root?.getAttribute('data-repo-name') || 'repository',
        commitSha: root?.getAttribute('data-commit-sha') || 'unpinned',
        branch: root?.getAttribute('data-branch') || 'main',
        scanDate: root?.getAttribute('data-scan-date') || new Date().toISOString(),
        clientName: root?.getAttribute('data-client-name') || '',
      }
    })

    const defaultFilename = `arbor-audit-${slugifyFileSegment(meta.repoName)}-${meta.commitSha.slice(0, 7)}.pdf`
    const resolvedOut = path.resolve(process.cwd(), outPath ?? defaultFilename)
    fs.mkdirSync(path.dirname(resolvedOut), { recursive: true })

    await page.emulateMedia({ media: 'print' })
    await page.pdf({
      path: resolvedOut,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: buildFooterTemplate(meta),
      margin: {
        top: '14mm',
        right: '14mm',
        bottom: '18mm',
        left: '14mm',
      },
    })

    const stat = fs.statSync(resolvedOut)
    if (stat.size === 0) {
      throw new Error(`Generated PDF at ${resolvedOut} is 0 bytes`)
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          output: resolvedOut,
          bytes: stat.size,
          repository: meta.repoName,
          branch: meta.branch,
          commitSha: meta.commitSha,
          scanDate: meta.scanDate,
          ...(meta.clientName ? { clientName: meta.clientName } : {}),
        },
        null,
        2
      )
    )
  } finally {
    await browser.close()
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[report:pdf] ${message}`)
  process.exit(1)
})
