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
  await expect(bPage).toHaveURL(/\/groups\/\d+\/polls\/\d+/)
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
  await expect(bPage).toHaveURL(/\/groups\/\d+\/polls\/\d+/)
  await expect(bPage.getByText(poll.title)).toBeVisible()

  await fastForward(page, 6)

  await expect(page.getByText('Results There is no winning')).toBeVisible()

  //TODO second comment and poll ff notifications, maybe also evaluation.

  await comment(page, 'Notify about me please')
})

// Same flow as Poll-Start-To-Finish-Notification, but both users are on a phone.
// On mobile the bell belongs in the top header; the bottom navigation bar should only
// hold the page links (no bell, dark mode toggle or profile picture).
test('Poll-Start-To-Finish-Notification-Mobile', async ({ page }) => {
  test.setTimeout(120000)
  await page.setViewportSize(PHONE)
  await register(page)
  await expectBellOnlyInTopHeader(page)

  const bPage = await newWindow()
  await bPage.setViewportSize(PHONE)
  await register(bPage)

  const group = { name: 'Test Poll start to finish notifications mobile' + randomString(), public: true }
  await createGroup(page, group)

  await gotoGroup(page, group)
  await joinGroup(bPage, group)
  await gotoGroup(bPage, group)

  await bPage.locator('#group-header').getByRole('button').filter({ hasText: /^$/ }).click()
  await bPage.getByRole('button', { name: 'Subscribe to All', exact: true }).click()

  const poll = { title: 'title' + randomString(), phase_time: 1 }
  // On mobile "Create a post" is inside the collapsed group menu
  await page.getByRole('button', { name: 'Open Menu' }).click()
  await createPoll(page, poll)

  await expect(async () => {
    await bPage.reload()
    await expectBellOnlyInTopHeader(bPage)
    await bPage.locator('#top-header #notifications-list').click()
    await expect(bPage.getByRole('button', { name: 'A new poll has been posted' }).first()).toBeVisible({ timeout: 3000 })
  }).toPass()
  await bPage.getByRole('button', { name: 'A new poll has been posted' }).nth(0).click()
  await expect(bPage).toHaveURL(/\/groups\/\d+\/polls\/\d+/)
  await expect(bPage.getByText(poll.title)).toBeVisible()

  await bPage.locator('#notification-bell-poll').scrollIntoViewIfNeeded()
  await bPage.locator('#notification-bell-poll').click()
  await bPage.getByRole('button', { name: 'Subscribe to All' }).click()

  await comment(page, 'Notify about me please')

  await expect(async () => {
    await bPage.reload()
    await expectBellOnlyInTopHeader(bPage)
    await bPage.locator('#top-header #notifications-list').click()
    await expect(bPage.getByRole('button', { name: 'A new comment has been posted' }).first()).toBeVisible({ timeout: 3000 })
  }).toPass()
  await bPage.getByRole('button', { name: 'A new comment has been posted' }).nth(0).click()
  await expect(bPage).toHaveURL(/\/groups\/\d+\/polls\/\d+/)
  await expect(bPage.getByText(poll.title)).toBeVisible()

  await fastForward(page, 6)

  await expect(page.getByText('Results There is no winning')).toBeVisible()
})

const PHONE = { width: 390, height: 844 }

const expectBellOnlyInTopHeader = async (page) => {
  await expect(page.locator('#top-header #notifications-list')).toBeVisible()
  // '#header' is the bottom navigation bar on mobile
  await expect(page.locator('#header #notifications-list')).toHaveCount(0)
  await expect(page.locator('#header').getByRole('button', { name: 'Mode Toggle' })).toHaveCount(0)
  await expect(page.locator('#header #side-header-icon')).toHaveCount(0)
}

const comment = async (page, message: string) => {
  await page.getByPlaceholder('Write a comment...').click()
  await page.getByPlaceholder('Write a comment...').fill(message)
  await page.locator('button[type="submit"]').click()
}
