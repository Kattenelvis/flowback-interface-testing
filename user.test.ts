import { test, expect } from '@playwright/test'
import { login, logout, randomString, register } from './generic'

// TODO: This test,  if fails before changing back to a, may brick all other tests
test('Edit User', async ({ page }) => {
  const newName = randomString() + randomString()
  await register(page)
  await page.locator("#side-header-icon").click()
  await page.getByRole('button', { name: 'User Profile', exact: true }).click()
  await page.mouse.click(0, 0)
  await expect(page.getByText('Contact Information')).toBeVisible()
  await page.locator('#edit-profile-button').click()
  await page.getByLabel('Website').click()
  await page.getByLabel('Website').fill('http://www.google.com')
  await page.getByLabel('Mail').click()
  await page.getByLabel('Mail').fill('email@email.com')
  await page.getByLabel('Bio').click()
  await page.getByLabel('Bio').fill('I like pancakes :3')
  await page.getByLabel('Name').click()
  await page.getByLabel('Name').fill(newName)
  await page.getByRole('button', { name: 'Save changes' }).click()

  // Check the edits worked
  await expect(page.getByText('Profile successfully updated').nth(0)).toBeVisible()
  await expect(page.getByText(newName).nth(-1)).toBeVisible()
  await expect(page.getByText('I like pancakes :')).toBeVisible()
  await page.reload()
  await expect(page.getByText(newName).nth(-1)).toBeVisible()
  await expect(page.getByText('I like pancakes :')).toBeVisible()

  // Change username back to normal
  await page.locator('#edit-profile-button').click()
  await page.getByLabel('Name').fill(newName)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(newName).nth(-1)).toBeVisible()
  await expect(page.getByText('I like pancakes :')).toBeVisible()
  await logout(page)
})

