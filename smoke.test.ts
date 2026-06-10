import { test } from './fixtures'
import { login, logout, newWindow, createUser } from './generic'

// Nothing works if a freshly registered user cannot log in at all.
test('Smoke-Test', async ({ page }) => {
  const [a, b, c, d] = await Promise.all([createUser(), createUser(), createUser(), createUser()])
  const bPage = await newWindow()
  const dPage = await newWindow()
  await login(page, a)
  await login(bPage, b)
  await logout(page)
  await login(page, c)
  await logout(page)
  await login(dPage, d)
  await logout(bPage)
  await logout(dPage)
})
