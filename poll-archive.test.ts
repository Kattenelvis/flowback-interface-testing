import test, { expect } from '@playwright/test'
import { randomString, register } from './generic'
import { createGroup, gotoGroup } from './group'
import { createPoll, fastForward } from './poll'

// A poll that leaves the proposal phase without a single proposal can never
// be voted on, so the backend archives it and the feed hides it by default.
test('Poll-Without-Proposals-Is-Archived', async ({ page }) => {
  await register(page)

  const group = { name: 'Test Group Poll Archive' + randomString(), public: false }
  await createGroup(page, group)
  await gotoGroup(page, group)

  const title = 'Archive Poll' + randomString()
  await createPoll(page, { title, phase_time: 2 })

  await test.step('Poll leaves the proposal phase without proposals', async () => {
    await fastForward(page, 1)
    await expect(page.locator('#poll-timeline')).toContainText(/Prediction/i)
  })

  const thumbnail = page.locator('#thumbnails').getByRole('button', { name: title, exact: true })

  await test.step('Feed hides the archived poll by default', async () => {
    await gotoGroup(page, group)
    // Only shown once the feed has finished loading and has nothing in it
    await expect(page.getByText('No posts currently here')).toBeVisible()
    await expect(thumbnail).toHaveCount(0)
  })

  await test.step('Feed shows the archived poll when archived is enabled', async () => {
    await page.getByLabel('Show archived').check()
    await expect(thumbnail).toBeVisible()
  })
})
