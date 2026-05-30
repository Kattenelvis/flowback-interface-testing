import { test, expect } from '@playwright/test'
import { login } from './generic'

test('Create-Edit-Delete-Schedule-Event', async ({ page }) => {
  await login(page)

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
  const dateInputs = page.locator('input[type="datetime-local"]')
  await dateInputs.nth(1).fill('2026-08-18T00:01')

  // Test invalid meeting link
  await page.getByLabel('Meeting Link').fill('hshshsh')
  await page.locator('#Submit').click()
  await expect(page.getByText('Failed to create event')).not.toBeVisible()
  await expect(page.getByText('Successfully created event')).toBeVisible()

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
  const editDateInputs = page.locator('input[type="datetime-local"]')
  await editDateInputs.nth(1).fill('2027-08-16T00:01')

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
