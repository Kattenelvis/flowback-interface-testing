import { test, chromium, expect } from '@playwright/test'
import { register, newWindow, randomString } from './generic'
import { createGroup, gotoGroup, joinGroup } from './group'
import { createPoll, fastForward, results } from './poll'
import { Group, Poll } from './types'
import { env } from 'process'

test('Group-Notification', async ({ page }) => {
  const group: Group = { name: 'GroupTesting' + randomString(), public: true }
  await register(page)
  await createGroup(page, group)

  const bPage = await newWindow()
  await register(bPage)

  await joinGroup(bPage, group)
  await gotoGroup(bPage, group)
  await bPage.locator('#group-header').getByRole('button').filter({ hasText: /^$/ }).click()
  await bPage.getByRole('button', { name: 'Subscribe to All', exact: true }).click()
  // await bPage.getByRole('button', { name: 'Group User', exact: true }).click()
  // await bPage.getByRole('button', { name: 'Kanban', exact: true }).click()
  // await bPage.getByRole('button', { name: 'Polls', exact: true }).click()
  // await bPage.getByRole('button', { name: 'Events', exact: true }).click()
  // await bPage.getByRole('button', { name: 'Threads', exact: true }).click()

  const poll: Poll = { title: 'NotificationPoll' + randomString() }
  await createPoll(page, poll)

  // TOOD: Once notification system is done, set an expect here to get the right message and that the notification link leads to the right poll

  // Creator (A) is not subscribed, so gets no "new poll" notification
  await page.locator('#notifications-list').click()
  await expect(page.getByRole('button', { name: 'A new poll has been posted' })).toHaveCount(0)

  // Subscriber (B) receives exactly one. Notification delivery is async (celery),
  // so reload and reopen the list until it arrives.
  await expect(async () => {
    await bPage.reload()
    await bPage.locator('#notifications-list').click()
    await expect(bPage.getByRole('button', { name: 'A new poll has been posted' }).first()).toBeVisible({ timeout: 3000 })
  }).toPass()
})

// TODO: Move this into another test such as Poll-Start-To-Finish or Group-Notification
// TODO: Add more group notification tests
test('Poll-Start-To-Finish-Notification', async ({ page }) => {
  test.setTimeout(120000)
  await register(page)

  const bPage = await newWindow()
  await register(bPage)

  const group = { name: 'Test Poll start to finish notifications' + randomString(), public: true }
  await createGroup(page, group)

  await gotoGroup(page, group)
  await joinGroup(bPage, group)
  await gotoGroup(bPage, group)

  await bPage.locator('#group-header').getByRole('button').filter({ hasText: /^$/ }).click()
  await bPage.getByRole('button', { name: 'Subscribe to All', exact: true }).click()

  const poll = { title: 'title' + randomString(), phase_time: 1 }
  await createPoll(page, poll)

  // Notification delivery is async (celery); reload and reopen until it arrives
  await expect(async () => {
    await bPage.reload()
    await bPage.locator('#notifications-list').click()
    await expect(bPage.getByRole('button', { name: 'A new poll has been posted' }).first()).toBeVisible({ timeout: 3000 })
  }).toPass()
  await bPage.getByRole('button', { name: 'A new poll has been posted' }).nth(0).click()
  await expect(bPage.getByText(poll.title)).toBeVisible()

  // Scroll the bell up before opening so its dropdown ("Subscribe to All")
  // renders fully in view instead of below the viewport fold.
  await bPage.locator('#notification-bell-poll').scrollIntoViewIfNeeded()
  await bPage.evaluate(() => window.scrollBy(0, 200))
  await bPage.locator('#notification-bell-poll').click()
  await bPage.getByRole('button', { name: 'Subscribe to All' }).click()

  await comment(page, 'Notify about me please')

  await expect(async () => {
    await bPage.reload()
    await bPage.locator('#notifications-list').click()
    await expect(bPage.getByRole('button', { name: 'A new comment has been posted' }).first()).toBeVisible({ timeout: 3000 })
  }).toPass()
  await bPage.getByRole('button', { name: 'A new comment has been posted' }).nth(0).click()
  await expect(bPage.getByText(poll.title)).toBeVisible()

  await fastForward(page, 6)

  await expect(page.getByText('Results There is no winning')).toBeVisible()

  //TODO second comment and poll ff notifications, maybe also evaluation.

  await comment(page, 'Notify about me please')
})

const comment = async (page, message: string) => {
  await page.getByPlaceholder('Write a comment...').click()
  await page.getByPlaceholder('Write a comment...').fill(message)
  await page.locator('button[type="submit"]').click()
}
