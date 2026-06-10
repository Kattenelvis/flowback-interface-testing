import { test } from './fixtures'
import { login, logout, loginEnter, register } from './generic'

test('Login', async ({ page, user }) => {
  await login(page, user)
})

test('Login-Enter', async ({ page, user }) => {
  await loginEnter(page, user)
})

// TODO: Use automated email testing
test('Register', async ({ page }) => {
  test.skip()
  await register(page)
})

test('Logout', async ({ page, user }) => {
  await login(page, user)
  await logout(page)
})
