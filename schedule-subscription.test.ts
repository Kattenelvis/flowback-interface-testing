import { test, expect } from '@playwright/test'
import { newWindow, randomString, register } from './generic'

const DAY = 24 * 60 * 60 * 1000
const DAILY = 1

const authorized = async (page: any) => ({
  Authorization: `Token ${await page.evaluate(() => localStorage.getItem('token'))}`,
})

const nextMonthsDate = (day: number) => {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() + 1, day)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(day)}`
}

// A creates a group that B joins, A is the one making events in it
const shareGroup = async (page: any, bPage: any) => {
  await register(page)
  await register(bPage)

  const created = await page.request.post(`${process.env.LINK}/api/group/create`, {
    headers: await authorized(page),
    multipart: {
      name: 'Event subscription ' + randomString(),
      description: 'Group for event subscriptions',
      direct_join: 'true',
      public: 'true',
      blockchain_id: String(Math.floor(Math.random() * 2147483647)),
      hide_poll_users: 'false',
    },
  })
  expect(created.ok()).toBe(true)
  const groupId = await created.json()

  const joined = await bPage.request.post(`${process.env.LINK}/api/group/${groupId}/join`, {
    headers: await authorized(bPage),
  })
  expect(joined.ok()).toBe(true)

  return groupId
}

const createEvent = async (page: any, groupId: number, title: string, start: Date, repeat_frequency: number | null = null) => {
  const event = await page.request.post(`${process.env.LINK}/api/group/${groupId}/schedule/event/create`, {
    headers: await authorized(page),
    data: {
      title,
      start_date: start.toISOString(),
      end_date: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      repeat_frequency,
    },
  })
  expect(event.ok()).toBe(true)
}

// A repeating event starts tomorrow, one that doesn't repeat is held at noon the 15th of next month
const openOthersEvent = async (page: any, bPage: any, repeat_frequency: number | null) => {
  const groupId = await shareGroup(page, bPage)

  const title = (repeat_frequency ? 'Daily meeting ' : 'Meeting ') + randomString()
  const start = repeat_frequency ? new Date(Date.now() + DAY) : new Date(`${nextMonthsDate(15)}T12:00:00Z`)
  await createEvent(page, groupId, title, start, repeat_frequency)

  await openEvent(bPage, title)
  return title
}

const openEvent = async (bPage: any, title: string, day = 15) => {
  await bPage.goto(`${process.env.LINK}/schedule`)
  await expect(bPage.locator('.fc-dayGridMonth-view')).toBeVisible()
  await bPage.getByRole('button', { name: 'Next month' }).click()
  await bPage.locator(`.fc-daygrid-day[data-date="${nextMonthsDate(day)}"] .fc-daygrid-event`, { hasText: title }).click()
  await bPage.locator('#notification-bell-event').click()
}

const subscribedEvent = async (bPage: any, title: string) => {
  const response = await bPage.request.get(`${process.env.LINK}/api/schedule/event/list?title=${encodeURIComponent(title)}`, {
    headers: await authorized(bPage),
  })
  expect(response.ok()).toBe(true)
  const [event] = (await response.json()).results
  return { subscribed: event.subscribed as boolean, occurrence: event.subscribed_occurrence as string | null }
}

const option = (bPage: any, name: 'All occurrences' | 'Only this occurrence' | 'subsc') =>
  bPage.getByRole('button', { name, exact: true })

// Somebody else's repeating meeting that ends up in my calendar can be followed as the whole series,
// or just the occurrence I clicked on
test('Schedule-Subscribe-Repeating-Event-Series-Or-Single-Occurrence', async ({ page }) => {
  const bPage = await newWindow()
  await openOthersEvent(page, bPage, DAILY)

  await expect(option(bPage, 'All occurrences')).toBeVisible()
  await expect(option(bPage, 'Only this occurrence')).toBeVisible()
})

// An event that doesn't repeat has no series to choose between
test('Schedule-Subscribe-Single-Event-Has-No-Series-Choice', async ({ page }) => {
  const bPage = await newWindow()
  await openOthersEvent(page, bPage, null)

  await expect(option(bPage, 'subsc')).toBeVisible()
  await expect(option(bPage, 'Only this occurrence')).toHaveCount(0)
})

// The bell shows what the user already follows when the event is opened again
test('Schedule-Event-Subscription-Is-Shown-When-Reopened', async ({ page }) => {
  const bPage = await newWindow()
  const title = await openOthersEvent(page, bPage, DAILY)

  await option(bPage, 'All occurrences').click()
  await expect(bPage.getByText('Subscribed', { exact: true })).toBeVisible()
  expect(await subscribedEvent(bPage, title)).toEqual({ subscribed: true, occurrence: null })

  await openEvent(bPage, title)
  await expect(option(bPage, 'All occurrences')).toHaveAttribute('aria-pressed', 'true')
  await expect(option(bPage, 'Only this occurrence')).toHaveAttribute('aria-pressed', 'false')
})

// Pressing a followed event again stops following it
test('Schedule-Event-Unsubscribe', async ({ page }) => {
  const bPage = await newWindow()
  const title = await openOthersEvent(page, bPage, DAILY)

  await option(bPage, 'All occurrences').click()
  await expect(bPage.getByText('Subscribed', { exact: true })).toBeVisible()
  expect(await subscribedEvent(bPage, title)).toEqual({ subscribed: true, occurrence: null })

  await option(bPage, 'All occurrences').click()
  await expect(bPage.getByText('Unsubscribed', { exact: true })).toBeVisible()
  await expect.poll(() => subscribedEvent(bPage, title)).toEqual({ subscribed: false, occurrence: null })

  await openEvent(bPage, title)
  await expect(option(bPage, 'All occurrences')).toHaveAttribute('aria-pressed', 'false')
})

// Following one occurrence is remembered for that occurrence only, the others of the series are still open to follow
test('Schedule-Event-Subscribe-Single-Occurrence', async ({ page }) => {
  const bPage = await newWindow()
  const title = await openOthersEvent(page, bPage, DAILY)

  await option(bPage, 'Only this occurrence').click()
  await expect(bPage.getByText('Subscribed', { exact: true })).toBeVisible()
  const followed = await subscribedEvent(bPage, title)
  expect(followed.subscribed).toBe(true)
  expect(new Date(followed.occurrence!).toISOString()).toContain(`${nextMonthsDate(15)}T`)

  await openEvent(bPage, title)
  await expect(option(bPage, 'Only this occurrence')).toHaveAttribute('aria-pressed', 'true')
  await expect(option(bPage, 'All occurrences')).toHaveAttribute('aria-pressed', 'false')

  await openEvent(bPage, title, 16)
  await expect(option(bPage, 'Only this occurrence')).toHaveAttribute('aria-pressed', 'false')
  await expect(option(bPage, 'All occurrences')).toHaveAttribute('aria-pressed', 'false')
})

// Following the series replaces following one occurrence, and the other way around
test('Schedule-Event-Switch-Between-Series-And-Single-Occurrence', async ({ page }) => {
  const bPage = await newWindow()
  const title = await openOthersEvent(page, bPage, DAILY)

  await option(bPage, 'All occurrences').click()
  await expect(option(bPage, 'All occurrences')).toHaveAttribute('aria-pressed', 'true')

  await option(bPage, 'Only this occurrence').click()
  await expect(option(bPage, 'Only this occurrence')).toHaveAttribute('aria-pressed', 'true')
  await expect(option(bPage, 'All occurrences')).toHaveAttribute('aria-pressed', 'false')
  expect((await subscribedEvent(bPage, title)).occurrence).not.toBeNull()

  await option(bPage, 'All occurrences').click()
  await expect(option(bPage, 'All occurrences')).toHaveAttribute('aria-pressed', 'true')
  await expect(option(bPage, 'Only this occurrence')).toHaveAttribute('aria-pressed', 'false')
  expect(await subscribedEvent(bPage, title)).toEqual({ subscribed: true, occurrence: null })
})

// A reminder about an event is shown ahead of the event, not when it starts
test('Schedule-Event-Reminder-Is-Shown-Before-The-Event', async ({ page }) => {
  test.setTimeout(120000)
  const bPage = await newWindow()
  const groupId = await shareGroup(page, bPage)

  const title = 'Reminded meeting ' + randomString()
  const start = new Date(Date.now() + 100 * 1000)
  await createEvent(page, groupId, title, start)

  const events = await bPage.request.get(`${process.env.LINK}/api/schedule/event/list?title=${encodeURIComponent(title)}`, {
    headers: await authorized(bPage),
  })
  const [event] = (await events.json()).results
  const subscribed = await bPage.request.post(`${process.env.LINK}/api/schedule/${event.schedule_id}/event/subscribe`, {
    headers: await authorized(bPage),
    data: { event_ids: String(event.id), reminders: '60' },
  })
  expect(subscribed.ok()).toBe(true)

  const reminder = bPage.getByRole('button', { name: `Event starts soon: ${title}` })
  await bPage.reload()
  await bPage.locator('#notifications-list').click()
  await expect(bPage.getByText('No notifications')).toBeVisible()

  // The reminder comes a minute before the event, which is a little under a minute from now
  await expect(async () => {
    await bPage.reload()
    await bPage.locator('#notifications-list').click()
    await expect(reminder).toBeVisible({ timeout: 3000 })
  }).toPass({ timeout: 60000 })
  expect(Date.now()).toBeLessThan(start.getTime())
})
