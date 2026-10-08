import { test, expect } from '@playwright/test'
import { randomString, register } from './generic'

test('Create-Edit-Delete-Schedule-Event', async ({ page }) => {
  await register(page)

  // Navigate to schedule page
  await page.goto(`${process.env.LINK}/schedule`)
  await page.waitForTimeout(1000)

  // Click a date cell in FullCalendar to open create modal
  await page.locator('.fc-daygrid-day').nth(15).click()
  await page.waitForTimeout(300)

  // Fill in event form
  await page.getByLabel('Title').fill('Event at 15th')
  await page.getByLabel('Description').fill('This is a test event at 15th')

  // Fill end date (second datetime-local input)
  const dateInputs = page.locator("input[type='datetime-local']")
  const endDate = new Date(await dateInputs.nth(0).inputValue())
  endDate.setHours(endDate.getHours() + 1)
  const formatDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0")
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes())
  }
  await dateInputs.nth(1).fill(formatDateTime(endDate))

  // Test invalid meeting link
  // await page.getByLabel('Meeting Link').fill('hshshsh')
  // await page.locator('#Submit').click()
  // await expect(page.getByText('Failed to create event')).toBeVisible()
  // await expect(page.getByText('Successfully created event')).not.toBeVisible()

  // Fix meeting link and submit
  await page.getByLabel('Meeting Link').fill('https://example.com')
  await page.locator('#Submit').click()
  await expect(page.getByText('Failed to create event')).not.toBeVisible()
  await expect(page.getByText('Successfully created event')).toBeVisible()

  // Wait for calendar to update
  await page.waitForTimeout(1000)

  // Click the created event to open edit modal
  await page.locator('.fc-event', { hasText: 'Event at 15th' }).first().click()
  await page.waitForTimeout(300)

  // Edit the event title
  await page.getByLabel('Title').fill('newly edited title')

  // Change end date
  const editDateInputs = page.locator("input[type='datetime-local']")
  const editedEndDate = new Date(await editDateInputs.nth(0).inputValue())
  editedEndDate.setHours(editedEndDate.getHours() + 2)
  await editDateInputs.nth(1).fill(formatDateTime(editedEndDate))

  // Submit the edit
  await page.locator('#Submit').click()
  await expect(page.getByText('Failed to create event')).not.toBeVisible()
  await expect(page.getByText('Successfully edited event')).toBeVisible()

  // Wait for calendar to update
  await page.waitForTimeout(1000)

  // Click the edited event and delete it
  await page.locator('.fc-event', { hasText: 'newly edited title' }).first().click()
  await page.waitForTimeout(300)

  await page.locator('#Delete').click()
  await expect(page.getByText('Successfully deleted event')).toBeVisible()
})

// SCH-R02: the schedule can switch between month, week and day views
test('Schedule-Switch-Views', async ({ page }) => {
  await register(page)
  await page.goto(`${process.env.LINK}/schedule`)

  const title = page.locator('.fc-toolbar-title')
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Month', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible()

  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Week', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.fc-col-header-cell')).toHaveCount(7)
  await expect(page.getByRole('button', { name: 'Next week' })).toBeVisible()

  await page.getByRole('button', { name: 'Day', exact: true }).click()
  await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()
  await expect(page.locator('.fc-col-header-cell')).toHaveCount(1)

  // Navigation steps one day at a time in the day view
  const dayTitle = await title.innerText()
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(title).not.toHaveText(dayTitle)

  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible()
})

// On a phone the view switcher gets its own row; rotating the phone re-renders the calendar,
// which must keep the chosen view and date
test('Schedule-Switch-Views-Mobile', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await register(page)
  await page.goto(`${process.env.LINK}/schedule`)
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()

  for (const [name, view] of [['Week', 'timeGridWeek'], ['Day', 'timeGridDay'], ['Month', 'dayGridMonth']]) {
    const button = page.getByRole('button', { name, exact: true })
    await expect(button).toBeInViewport({ ratio: 1 })
    await button.click()
    await expect(page.locator(`.fc-${view}-view`)).toBeVisible()
  }

  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await page.getByRole('button', { name: 'Next week' }).click()
  const firstDay = await page.locator('.fc-col-header-cell').first().getAttribute('data-date')

  await page.setViewportSize({ width: PHONE.height, height: PHONE.width })
  // The add button only gets its full label once the calendar has re-rendered for the wider screen
  await expect(page.getByRole('button', { name: '+ Create Event' })).toBeVisible()
  await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible()
  await expect(page.locator('.fc-col-header-cell').first()).toHaveAttribute('data-date', firstDay!)
})

test.describe(() => {
  // The backend runs in UTC, so a timezone mix-up only shows when the browser is somewhere else
  test.use({ timezoneId: 'Europe/Stockholm' })

  // Events shorter than a day are shown at their time in the day view (not in the all-day row),
  // and editing one keeps its time
  test('Schedule-Day-View-Timed-Event', async ({ page }) => {
    await register(page)
    await page.goto(`${process.env.LINK}/schedule`)
    const openDayView = async () => {
      await page.getByRole('button', { name: 'Day', exact: true }).click()
      await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()
    }
    await openDayView()

    // A click on a slot selects half an hour. The event layer lies on top of the slots,
    // so click by position rather than on the slot element itself
    const slot = page.locator('.fc-timegrid-slot-lane[data-time="10:00:00"]')
    await slot.scrollIntoViewIfNeeded()
    const box = (await slot.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    await expect(page.getByText('Create an Event')).toBeVisible()
    const title = 'Short event ' + randomString()
    await page.getByLabel('Title').fill(title)
    await page.locator('#Submit').click()
    await expect(page.getByText('Successfully created event')).toBeVisible()

    const timedEvent = page.locator('.fc-timegrid-event', { hasText: title })
    await expect(timedEvent).toContainText('10:00 - 10:30')
    await expect(page.locator('.fc-timegrid .fc-daygrid-event', { hasText: title })).toHaveCount(0)

    // Save it unchanged, then reload so the time shown comes straight from the backend
    await timedEvent.click()
    await expect(page.getByText(`Edit Event ${title}`)).toBeVisible()
    await page.locator('#Submit').click()
    await expect(page.getByText('Successfully edited event')).toBeVisible()

    await page.reload()
    await openDayView()
    await expect(timedEvent).toContainText('10:00 - 10:30')
  })

  // In the month view an event can be stretched over more days, and keeps its times of day
  test('Schedule-Month-View-Resize', async ({ page }) => {
    await register(page)
    await page.goto(`${process.env.LINK}/schedule`)
    await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()

    const now = new Date()
    const dayOfThisMonth = (day: number) =>
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    await page.getByRole('button', { name: '+ Create Event' }).click()
    const title = 'Stretched event ' + randomString()
    await page.getByLabel('Title').fill(title)
    const dates = page.locator("input[type='datetime-local']")
    await dates.nth(0).fill(`${dayOfThisMonth(15)}T10:00`)
    await dates.nth(1).fill(`${dayOfThisMonth(15)}T10:30`)
    await page.locator('#Submit').click()
    await expect(page.getByText('Successfully created event')).toBeVisible()

    const event = page.locator('.fc-daygrid-event', { hasText: title })
    await expect(event).toContainText('10a')

    // The resize handle only shows while hovering the event
    await event.hover()
    const handle = (await event.locator('.fc-event-resizer-end').boundingBox())!
    const nextDay = (await page.locator(`.fc-daygrid-day[data-date="${dayOfThisMonth(16)}"]`).boundingBox())!
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(nextDay.x + nextDay.width / 2, nextDay.y + nextDay.height / 2, { steps: 10 })
    await page.mouse.up()
    await expect(page.getByText('Successfully edited event')).toBeVisible()

    await page.reload()
    await page.locator('.fc-daygrid-event', { hasText: title }).first().click()
    await expect(dates.nth(0)).toHaveValue(`${dayOfThisMonth(15)}T10:00`)
    await expect(dates.nth(1)).toHaveValue(`${dayOfThisMonth(16)}T10:30`)
  })
})

const PHONE = { width: 390, height: 844 }
