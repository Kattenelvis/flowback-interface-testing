import { chromium, expect } from '@playwright/test'
import 'dotenv/config'

export const idfy = (text: string) => {
  return text.trim().replace(/\s+/g, '-').toLowerCase()
}

// Dismiss cookie-consent banner then welcome modal.
// Cookie button targeted by id to avoid strict-mode clash with the modal's "Ok".
export async function dismissPopups(page: any) {
  const cookieOk = page.locator('#cookies-accept')
  if (await cookieOk.isVisible()) await cookieOk.click()
  const welcomeOk = page.getByRole('button', { name: 'Ok', exact: true })
  if (await welcomeOk.isVisible()) await welcomeOk.click()
}

export async function newWindow() {
  const browser = await chromium.launch()
  const Context = await browser.newContext()
  const Page = await Context.newPage()
  return Page
}

export async function login(
  page: any,
  { username = process.env.MAINUSER_NAME ?? 'a', password = process.env.MAINUSER_PASS ?? 'a' } = {},
) {
  await page.goto(`${process.env.LINK}/login`)
  await expect(page.locator('#login-page')).toBeVisible()
  await page.waitForTimeout(700)

  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL(`${process.env.LINK}/home`)
  await dismissPopups(page)
}

export async function loginEnter(
  page: any,
  { username = process.env.MAINUSER_NAME ?? 'a', password = process.env.MAINUSER_PASS ?? 'a' } = {},
) {
  await page.goto(`${process.env.LINK}/login`)
  await expect(page.locator('#login-page')).toBeVisible()
  await page.waitForTimeout(700)

  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)
  await page.getByLabel('Password').press('Enter')

  await expect(page).toHaveURL(`${process.env.LINK}/home`)
}

// Minimal registration for other functions
export async function register(page: any) {
  const randomUsername = randomString()
  const randomEmail = `${randomUsername}@flowback.test`

  await page.goto(`${process.env.LINK}/login`)
  // Generous timeout: under heavy parallel load the frontend can be slow to render
  await expect(page.locator('#login-page')).toBeVisible({ timeout: 30000 })

  await page.getByRole('button', { name: 'Register' }).click()
  await page.getByLabel('Email').click()
  await page.getByLabel('Email').fill(randomEmail)
  await page.getByLabel('Yes').check()

  // Wait deterministically for the register response so we always capture the code
  const registerResponsePromise = page.waitForResponse(
    (response: any) => response.url().includes('register') && !response.url().includes('verify'),
  )
  await page.getByRole('button', { name: 'Send' }).click()
  const registrationCode = (await (await registerResponsePromise).text()).slice(1, -1)
  await expect(page.getByText('Email Sent')).toBeVisible()

  await page.goto(`${process.env.LINK}/login/create`)
  // Verify form is rendered inline (selectedPage='Verify'), no navigation needed
  await expect(page.getByLabel('Verification Code')).toBeVisible({ timeout: 30000 })
  await page.getByLabel('Verification Code').fill(registrationCode)
  await page.getByLabel('Username').fill(randomUsername)
  await page.getByLabel('Choose a Password').fill(process.env.TEST_PASS)
  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.getByText('Success')).toBeVisible()
  await page.waitForTimeout(2000)
  await expect(page).toHaveURL(`${process.env.LINK}/home`)

  await dismissPopups(page)

  return { username: randomUsername, email: randomEmail, password: process.env.TEST_PASS }
}
// Tests registring a user
// Only works if PUBLIC_EMAIL_REGISTRATION=FALSE in .env in the flowback-backend repository
// TODO: Automated Email testing
export async function registerTest(page: any) {
  const randomUsername = randomString()
  const randomEmail = `${randomUsername}@flowback.test`

  await page.goto(`${process.env.LINK}/login`)
  await expect(page.locator('#login-page')).toBeVisible()
  await page.waitForTimeout(500)

  await page.getByRole('button', { name: 'Register' }).click()

  await page.getByLabel('Email').click()
  await page.getByLabel('Email').fill(randomEmail)
  // await page.getByLabel('Email').fill('a@a.se')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('You must accept terms of')).toBeVisible()
  await page.getByLabel('Yes').check()
  await page.getByRole('button', { name: 'Send' }).click()
  // await expect(page.getByText('ail already exists.')).toBeVisible()

  // await page.getByLabel('Email').fill(randomEmail)

  let registrationCode = ''
  await page.on('response', async (response: any) => {
    if (response.url().includes('register') && !response.url().includes('verify')) {
      registrationCode = (await response.text()).slice(1, -1)
    }
  })

  // await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Email Sent')).toBeVisible()

  await page.goto(`${process.env.LINK}/login/create`)

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
  await page.waitForTimeout(2000)
  await expect(page).toHaveURL(`${process.env.LINK}/home`)

  await dismissPopups(page)

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
