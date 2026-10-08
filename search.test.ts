import { test, expect } from '@playwright/test'
import { randomString, register } from './generic'

test('Search-No-Results', async ({ page }) => {
  const nonexistent = 'nonexistent__' + randomString()
  await register(page)

  // Polls on the home page
  await page.getByRole('button', { name: 'Home' }).click()
  await page.getByPlaceholder('Search polls').fill(nonexistent)
  await expect(page.getByText('No search results found')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByPlaceholder('Search polls')).toHaveValue('')
  await expect(page.getByText('No search results found')).not.toBeVisible()

  // Groups on the groups page
  await page.locator('#groups').click()
  await page.getByPlaceholder('Search groups').fill(nonexistent)
  await expect(page.getByText('No search results found')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByPlaceholder('Search groups')).toHaveValue('')
  await expect(page.getByText('No search results found')).not.toBeVisible()
})
