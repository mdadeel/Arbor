import { chromium } from '@playwright/test'
import * as path from 'node:path'
import * as fs from 'node:fs'

const BASE_URL = process.env.APP_URL || 'http://localhost:3000'
const ASSETS_DIR = path.resolve(process.cwd(), 'case-study/assets')

async function capture() {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true })
  }

  const browser = await chromium.launch({ headless: true })

  // 1. Landing Page (Desktop 1440x1000)
  console.log('Capturing 01-landing-page.png...')
  const landingContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  })
  const landingPage = await landingContext.newPage()
  await landingPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await landingPage.waitForTimeout(1000)
  await landingPage.screenshot({
    path: path.join(ASSETS_DIR, '01-landing-page.png'),
    fullPage: false,
  })
  await landingContext.close()

  // 2. Consultant Audit Report (Desktop 1440x1100)
  const shareToken = 'toa1MpVn7Mz_Ez7DGF0voxSSy10PPQI6KzojIJPJ9g0'
  console.log('Capturing 07-consultant-audit-report.png...')
  const reportContext = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 2,
  })
  const reportPage = await reportContext.newPage()
  await reportPage.goto(`${BASE_URL}/report/${shareToken}`, { waitUntil: 'networkidle' })
  await reportPage.waitForTimeout(1500)
  await reportPage.screenshot({
    path: path.join(ASSETS_DIR, '07-consultant-audit-report.png'),
    fullPage: false,
  })
  await reportContext.close()

  // 3. Authenticated Admin Session
  console.log('Authenticating admin session...')
  const authContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  })
  const authPage = await authContext.newPage()
  await authPage.goto(`${BASE_URL}/admin-login`, { waitUntil: 'networkidle' })
  await authPage.fill('input[type="text"]', process.env.ADMIN_USERNAME || '')
  await authPage.fill('input[type="password"]', process.env.ADMIN_PASSWORD || '')
  await authPage.click('button[type="submit"]')
  await authPage.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {})
  await authPage.waitForTimeout(1000)

  // 4. Dashboard Workbench
  console.log('Capturing 02-dashboard-workbench.png...')
  await authPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
  await authPage.waitForTimeout(1500)
  await authPage.screenshot({
    path: path.join(ASSETS_DIR, '02-dashboard-workbench.png'),
    fullPage: false,
  })

  // 5. Project Overview (Scrolled to Tab Content)
  console.log('Capturing 03-project-overview.png...')
  await authPage.goto(`${BASE_URL}/projects/erp-mvp-backend`, { waitUntil: 'networkidle' })
  await authPage.waitForTimeout(1500)
  await authPage.evaluate(() => {
    const tabs = document.querySelector('[role="tablist"]') || document.querySelector('button[role="tab"]')
    if (tabs) {
      tabs.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  })
  await authPage.waitForTimeout(500)
  await authPage.screenshot({
    path: path.join(ASSETS_DIR, '03-project-overview.png'),
    fullPage: false,
  })

  // 6. Project Architecture Graph Tab
  console.log('Capturing 04-architecture-graph.png...')
  await authPage.goto(`${BASE_URL}/projects/erp-mvp-backend?tab=architecture`, { waitUntil: 'networkidle' })
  await authPage.waitForTimeout(2000)
  await authPage.evaluate(() => {
    const tabs = document.querySelector('[role="tablist"]') || document.querySelector('button[role="tab"]')
    if (tabs) {
      tabs.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  })
  await authPage.waitForTimeout(800)
  await authPage.screenshot({
    path: path.join(ASSETS_DIR, '04-architecture-graph.png'),
    fullPage: false,
  })

  // 7. Findings Workbench Tab
  console.log('Capturing 05-findings-workbench.png...')
  await authPage.goto(`${BASE_URL}/projects/erp-mvp-backend?tab=findings`, { waitUntil: 'networkidle' })
  await authPage.waitForTimeout(1500)
  await authPage.evaluate(() => {
    const tabs = document.querySelector('[role="tablist"]') || document.querySelector('button[role="tab"]')
    if (tabs) {
      tabs.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  })
  await authPage.waitForTimeout(500)
  await authPage.screenshot({
    path: path.join(ASSETS_DIR, '05-findings-workbench.png'),
    fullPage: false,
  })

  // 8. Platform Admin Console
  console.log('Capturing 06-admin-console.png...')
  await authPage.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' })
  await authPage.waitForTimeout(1500)
  await authPage.screenshot({
    path: path.join(ASSETS_DIR, '06-admin-console.png'),
    fullPage: false,
  })

  // 9. Frontend Project Overview (erp-mvp-frontend)
  console.log('Capturing 08-frontend-project-overview.png...')
  await authPage.goto(`${BASE_URL}/projects/erp-mvp-frontend`, { waitUntil: 'networkidle' })
  await authPage.waitForTimeout(1500)
  await authPage.evaluate(() => {
    const tabs = document.querySelector('[role="tablist"]') || document.querySelector('button[role="tab"]')
    if (tabs) {
      tabs.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  })
  await authPage.waitForTimeout(500)
  await authPage.screenshot({
    path: path.join(ASSETS_DIR, '08-frontend-project-overview.png'),
    fullPage: false,
  })

  await authContext.close()

  // 10. Mobile View (390x844) Scrolled to Scorecard
  console.log('Capturing 09-mobile-view.png...')
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(`${BASE_URL}/admin-login`, { waitUntil: 'networkidle' })
  await mobilePage.fill('input[type="text"]', process.env.ADMIN_USERNAME || '')
  await mobilePage.fill('input[type="password"]', process.env.ADMIN_PASSWORD || '')
  await mobilePage.click('button[type="submit"]')
  await mobilePage.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {})
  await mobilePage.waitForTimeout(1000)

  await mobilePage.goto(`${BASE_URL}/projects/erp-mvp-backend`, { waitUntil: 'networkidle' })
  await mobilePage.waitForTimeout(1500)
  await mobilePage.evaluate(() => {
    const scores = document.querySelector('[data-slot="score-row"]') || document.querySelector('button[role="tab"]')
    if (scores) {
      scores.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  })
  await mobilePage.waitForTimeout(500)
  await mobilePage.screenshot({
    path: path.join(ASSETS_DIR, '09-mobile-view.png'),
    fullPage: false,
  })
  await mobileContext.close()

  await browser.close()
  console.log('All screenshots refined and captured successfully!')
}

capture().catch((err) => {
  console.error('Capture failed:', err)
  process.exit(1)
})
