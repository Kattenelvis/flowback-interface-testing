import test from "playwright/test"
import { login, logout, newWindow, randomString, register, registerTest } from "./generic"
import { createGroup, gotoGroup } from "./group"

// Nothing works if users cannot be created, login or create a group at all
test('Smoke-Test', async ({ page }) => {
  const bPage = await newWindow()
  const dPage = await newWindow()
  const a = await registerTest(page)
  const group = { name: 'smoke-group' + randomString(), public: true }
  await createGroup(page, group)
  await gotoGroup(page, group)
  const b = await register(bPage)
  const d = await register(dPage)
  await logout(page)
  const c = await register(page)
  await logout(bPage)
  await logout(dPage)
  await logout(page)
  await login(page, a)
  await login(bPage, b)
  await login(dPage, d)
})


