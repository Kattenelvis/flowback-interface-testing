// Shared test base. Import `test`/`expect` from here instead of
// '@playwright/test' so every spec auto-closes the extra browsers opened via
// newWindow() and gets a freshly registered, isolated primary user.
import { test as base } from '@playwright/test'
import { closeWindows, createUser, setTestBrowser, type TestUser } from './generic'

export const test = base.extend<{ user: TestUser }>({
  // A fresh registered user per test, so the primary actor never collides
  // with other workers. Use as: test('...', async ({ page, user }) => {...})
  user: async ({}, use) => {
    await use(await createUser())
  },
})

test.beforeEach(async ({ browser }) => {
  // Reuse Playwright's managed browser for newWindow() contexts.
  setTestBrowser(browser)
})

test.afterEach(async () => {
  await closeWindows()
  setTestBrowser(null)
})

export default test
export { expect, chromium, firefox, webkit } from '@playwright/test'
export type { Response } from '@playwright/test'
