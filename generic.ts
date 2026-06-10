import { chromium, expect, request as playwrightRequest, type Browser, type Response } from '@playwright/test'
import 'dotenv/config'

export const idfy = (text: string) => {
  return text.trim().replace(/\s+/g, '-').toLowerCase()
}

// Extra "users" are modelled as isolated browser CONTEXTS inside a single
// shared browser per worker — not a fresh browser per call. Launching a full
// Chromium for every newWindow() caused a launch storm under 10 workers
// (10 workers x several windows) and resource-exhaustion flakiness. Contexts
// are cheap and still fully isolated (separate cookies/localStorage).
let _sharedBrowser: Browser | null = null
let _testBrowser: Browser | null = null
const _openContexts: import('@playwright/test').BrowserContext[] = []

// fixtures.ts sets the current test's Playwright-managed browser so newWindow()
// reuses it (one browser per worker, robustly managed) instead of launching its
// own. Falls back to a self-launched browser if not set.
export function setTestBrowser(browser: Browser | null) {
  _testBrowser = browser
}

export async function newWindow() {
  const browser = _testBrowser ?? (_sharedBrowser ??= await chromium.launch())
  const context = await browser.newContext()
  _openContexts.push(context)
  return await context.newPage()
}

// Closes the contexts opened during a test (called from the afterEach hook in
// fixtures.ts). The shared browser is left running and reused across tests in
// the worker; it is torn down when the worker process exits.
export async function closeWindows() {
  await Promise.all(_openContexts.splice(0).map((c) => c.close().catch(() => { })))
}

export const TEST_PASS = process.env.TEST_PASS ?? 'SecretPassword123123!'

export type TestUser = { username: string; password: string; email: string }

// Registers a brand-new user directly via the API (fast, no UI flow) so every
// test gets isolated accounts. Relies on the backend running with
// DEBUG_REGISTER_BYPASS_EMAIL_VERIFICATION=True, which returns the verification
// code in the register response.
export async function createUser(): Promise<TestUser> {
  const username = `u${randomString()}${randomString()}`
  const email = `${username}@flowback.test`
  const ctx = await playwrightRequest.newContext({ baseURL: process.env.BACKEND_LINK })
  try {
    const reg = await ctx.post('/api/register', { data: { email } })
    if (!reg.ok()) throw new Error(`register failed: ${reg.status()} ${await reg.text()}`)
    const verification_code = (await reg.json()) as string
    const verify = await ctx.post('/api/register/verify', {
      data: { username, verification_code, password: TEST_PASS },
    })
    if (!verify.ok()) throw new Error(`register/verify failed: ${verify.status()} ${await verify.text()}`)
  } finally {
    await ctx.dispose()
  }
  return { username, password: TEST_PASS, email }
}

// Registers a fresh user and logs them in on the given page. Returns the user
// so the caller can reference its (unique) username for invites/permissions.
export async function loginAsNewUser(page: any): Promise<TestUser> {
  const user = await createUser()
  await login(page, user)
  return user
}

export function responseMatches(response: Response, method: 'GET' | 'POST', path: RegExp) {
  try {
    return response.request().method() === method && path.test(new URL(response.url()).pathname.replace(/\/$/, ''))
  } catch {
    return false
  }
}

export async function expectOkResponse(response: Response, action: string) {
  let body = ''
  try {
    body = await response.text()
  } catch {
    body = ''
  }

  const details = body ? `${response.status()} ${response.url()} ${body.slice(0, 500)}` : `${response.status()} ${response.url()}`
  expect(response.ok(), `${action} failed: ${details}`).toBeTruthy()
}

async function gotoWithRetry(page: any, url: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      return
    } catch (error: any) {
      const message = String(error?.message ?? error)
      if (attempt === 3 || !/ERR_NETWORK_CHANGED|ERR_CONNECTION_RESET|ERR_INTERNET_DISCONNECTED/.test(message)) {
        throw error
      }
    }
  }
}

export async function login(
  page: any,
  { username = process.env.MAINUSER_NAME ?? 'a', password = process.env.MAINUSER_PASS ?? 'a' } = {},
) {
  await gotoWithRetry(page, `${process.env.LINK}/login`)
  await expect(page.locator('#login-page')).toBeVisible()

  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)
  const loginResponse = page.waitForResponse((response: Response) => responseMatches(response, 'POST', /\/login$/))
  await page.click('button[type="submit"]')
  await expectOkResponse(await loginResponse, 'Login')

  await expect(page).toHaveURL(`${process.env.LINK}/home`, { timeout: 15000 })
  if (await page.getByRole('button', { name: 'Ok', exact: true }).isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Ok', exact: true }).click()
  }
}

export async function loginEnter(
  page: any,
  { username = process.env.MAINUSER_NAME ?? 'a', password = process.env.MAINUSER_PASS ?? 'a' } = {},
) {
  await gotoWithRetry(page, `${process.env.LINK}/login`)
  await expect(page.locator('#login-page')).toBeVisible()

  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)
  const loginResponse = page.waitForResponse((response: Response) => responseMatches(response, 'POST', /\/login$/))
  await page.getByLabel('Password').press('Enter')
  await expectOkResponse(await loginResponse, 'Login')

  await expect(page).toHaveURL(`${process.env.LINK}/home`, { timeout: 15000 })
}

// Tests registring a user
// Only works if PUBLIC_EMAIL_REGISTRATION=FALSE in .env in the flowback-backend repository
// TODO: Automated Email testing
export async function register(page: any) {
  const randomUsername = randomString()
  const randomEmail = `${randomUsername}@flowback.test`

  await page.goto(`${process.env.LINK}/login`)
  await expect(page.locator('#login-page')).toBeVisible()
  await page.waitForTimeout(500)

  await page.getByRole('button', { name: 'Register' }).click()
  await page.getByLabel('Email').click()
  await page.getByLabel('Email').fill('a@a.se')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('You must accept terms of')).toBeVisible()
  await page.getByLabel('Yes').check()
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Email already exists.')).toBeVisible()

  await page.getByLabel('Email').fill(randomEmail)

  let registrationCode = ''
  await page.on('response', async (response: any) => {
    if (response.url().includes('register') && !response.url().includes('verify')) {
      registrationCode = await response.text()
    }
  })

  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Email Sent')).toBeVisible()
  await expect(page.getByText('Mail Sent')).toBeVisible()

  await page.getByLabel('Verification Code').click()
  await page.getByLabel('Verification Code').fill('geageageadgea')
  await page.getByLabel('Username').click()
  await page.getByLabel('Username').fill(randomUsername)
  await page.getByLabel('Choose a Password').click()
  await page.getByLabel('Choose a Password').fill(process.env.TEST_PASS)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Wrong verification code')).toBeVisible()
  await page.getByLabel('Verification Code').click()
  await page.getByLabel('Verification Code').press('Control+a')
  await page.getByLabel('Verification Code').fill(registrationCode.replace('"', '').replace('"', ''))

  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.getByText('Success')).toBeVisible()
  await expect(page).toHaveURL(`${process.env.LINK}/home`)

  if (await page.getByRole('button', { name: 'Ok' }).isVisible()) {
    await page.getByRole('button', { name: 'Ok' }).click()
  }

  return { username: randomUsername, email: randomEmail, password: process.env.TEST_PASS }
}

export async function logout(page: any) {
  await page.locator("#side-header-icon").click()
  await page.getByRole('button', { name: 'Log Out', exact: true }).click()
  await expect(page.getByRole('img', { name: 'flowback logo' })).toBeVisible()
}

export function randomString() {
  const rand = Math.random().toString(36).slice(2, 10)
  return rand
}
