import { test, expect } from '@playwright/test'
import { newWindow, randomString, register } from './generic'
import { gotoGroup } from './group'
import { createPoll, fastForward, goToPost } from './poll'

const authorized = async (page: any) => ({
  Authorization: `Token ${await page.evaluate(() => localStorage.getItem('token'))}`,
})

const pad = (value: number) => String(value).padStart(2, '0')

// A date poll's chosen time ends up among the day's other events in the month view, earliest in the day on top
test('Schedule-Events-Ordered-By-Time-In-Month-View', async ({ page }) => {
  test.setTimeout(120000)
  const bPage = await newWindow()

  await register(page)
  await register(bPage)

  const groupName = 'Event order ' + randomString()
  const created = await page.request.post(`${process.env.LINK}/api/group/create`, {
    headers: await authorized(page),
    multipart: {
      name: groupName,
      description: 'Group for ordering events',
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

  // Only admins can allow a poll to be fast forwarded
  const me = await bPage.request.get(`${process.env.LINK}/api/user`, { headers: await authorized(bPage) })
  const promoted = await page.request.post(`${process.env.LINK}/api/group/${groupId}/user/update`, {
    headers: await authorized(page),
    data: { target_user_id: (await me.json()).id, is_admin: true },
  })
  expect(promoted.ok(), await promoted.text()).toBe(true)

  const pollHour = 12
  const poll = { title: 'Meeting poll ' + randomString(), date: true }
  await gotoGroup(bPage, { name: groupName })
  await createPoll(bPage, poll)

  await goToPost(page, poll)
  const pollId = page.url().match(/polls\/(\d+)/)![1]
  const weekday = (new Date().getDay() + 6) % 7
  await page.locator('#weekView > button').nth(pollHour * 7 + weekday).click()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('Successfully saved selections')).toBeVisible()

  // The day the poll lands on is whatever the poll's grid says, so the events are made on that day
  const proposals = await page.request.get(`${process.env.LINK}/api/group/poll/${pollId}/proposals`, {
    headers: await authorized(page),
  })
  expect(proposals.ok()).toBe(true)
  const chosen = new Date((await proposals.json()).results[0].start_date)

  // The titles run against the clock, so ordering by title gives a different order than ordering by time
  const prefix = 'Order ' + randomString()
  const events = Array.from({ length: 10 }, (_, index) => ({
    title: `${prefix} ${String.fromCharCode('z'.charCodeAt(0) - index)}`,
    start: new Date(chosen.getFullYear(), chosen.getMonth(), chosen.getDate(), 6 + index, 30),
  }))
  for (const { title, start } of events) {
    const response = await page.request.post(`${process.env.LINK}/api/group/${groupId}/schedule/event/create`, {
      headers: await authorized(page),
      data: {
        title,
        start_date: start.toISOString(),
        end_date: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      },
    })
    expect(response.ok()).toBe(true)
  }

  await fastForward(page, 1)
  await expect(page.getByText('Results', { exact: true })).toBeVisible()

  const expected = [...events, { title: poll.title, start: chosen }]
    .sort((first, second) => first.start.getTime() - second.start.getTime())
    .map(({ title }) => title)

  await page.goto(`${process.env.LINK}/schedule`)
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
  const date = `${chosen.getFullYear()}-${pad(chosen.getMonth() + 1)}-${pad(chosen.getDate())}`
  const day = page.locator(`.fc-daygrid-day[data-date="${date}"]`)

  // The month cell only has room for a few events, the rest are behind "+ more", which lists the whole day
  await expect(day.locator('.fc-daygrid-more-link')).toBeVisible()
  await day.locator('.fc-daygrid-more-link').click()
  const listed = page.locator('.fc-popover .fc-daygrid-event')
  await expect(listed).toHaveCount(expected.length)
  const titles = (await listed.allTextContents()).map((text) => expected.find((title) => text.includes(title)))
  expect(titles).toEqual(expected)
})
