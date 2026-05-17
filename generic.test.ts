import test from '@playwright/test'
import { login, logout, loginEnter, register } from './generic'

test('Login', async ({ page }) => {
  await login(page)
})

test('Login-Enter', async ({ page }) => {
  await loginEnter(page)
})

// TODO: Use automated email testing
test('Register', async ({ page }) => {
  test.skip()
  await register(page)
})

test('Logout', async ({ page }) => {
  await login(page)
  await logout(page)
})
