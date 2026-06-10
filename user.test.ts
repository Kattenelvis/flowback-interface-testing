import { test, expect } from './fixtures'
import { login, logout } from './generic'

test('Edit User', async ({ page, user }) => {
  await login(page, user)
  await page.locator('#side-header-icon').click()
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
  const updateResponse = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/user/update'),
  )
  await page.getByRole('button', { name: 'Save changes' }).click()
  await updateResponse

  // Verify the editable contact fields persist by re-opening the edit form
  // after a reload and checking their values.
  await page.reload()
  await page.locator('#edit-profile-button').click()
  await expect(page.getByLabel('Bio')).toHaveValue('I like pancakes :3')
  await expect(page.getByLabel('Website')).toHaveValue('http://www.google.com')
  await expect(page.getByLabel('Mail')).toHaveValue('email@email.com')
  await logout(page)
})
