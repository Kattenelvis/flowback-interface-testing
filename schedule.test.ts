import { test, expect } from '@playwright/test'
import { register } from './generic'

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

const PHONE = { width: 390, height: 844 }
