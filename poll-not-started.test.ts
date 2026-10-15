import test, { expect } from '@playwright/test'
import { randomString, register } from './generic'
import { createGroup, gotoGroup } from './group'
import { createPoll } from './poll'

// A poll whose start date is still in the future has the backend phase "waiting".
// The frontend has no phase config for it, so the feed shows every phase as completed
// and the poll page renders no timeline and no controls at all.
test('Poll-Not-Started-Does-Not-Look-Completed', async ({ page }) => {
  await register(page)

  const group = { name: 'Test Group Poll Not Started' + randomString(), public: false }
  await createGroup(page, group)
  await gotoGroup(page, group)

  const title = 'Not Started Poll' + randomString()
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await createPoll(page, { title, phase_time: 2, fastForward: false, startDate: tomorrow })

  await test.step('Poll page shows a timeline with a named phase', async () => {
    const timeline = page.locator('#poll-timeline')
    await expect(timeline).toBeVisible()
    await expect(timeline).toContainText(/Phase\s+\S/)
  })

  await test.step('Feed does not show the poll as completed', async () => {
    await gotoGroup(page, group)
    const thumbnail = page.locator('#thumbnails > div').filter({ hasText: title })
    await expect(thumbnail).toBeVisible()
    await expect(thumbnail.locator('#poll-timeline')).toContainText(/Phase\s+\S/)
    await expect(thumbnail.locator('svg[data-icon="circle-check"]')).toHaveCount(0)
  })
})
