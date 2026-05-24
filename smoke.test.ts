import test from "playwright/test"
import { login, logout, newWindow } from "./generic"

// Nothing works if user cannot login at all, with all default testing accounts
test('Smoke-Test', async ({ page }) => {
  await login(page)
  const bPage = await newWindow()
  await login(bPage, { username: process.env.SECONDUSER_NAME, password: process.env.SECONDUSER_PASS })
  await logout(page)
  await login(page, { username: process.env.THIRDUSER_NAME, password: process.env.THIRDUSER_PASS })
  await logout(page)
  await logout(bPage)
})

