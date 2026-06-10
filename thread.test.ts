import test, { expect } from './fixtures'
import { login, randomString } from './generic'
import { createGroup, gotoGroup } from './group'
import { createThread } from './thread'

const group = { name: 'Test Group Thread' + randomString(), public: false }

test('Thread-Create', async ({ page, user }) => {
  await login(page, user)

  await createGroup(page, group)

  await gotoGroup(page, group)

  await createThread(page, group)
})

test('Thread-Comments', async ({ page, user }) => {
  await login(page, user)

  await createGroup(page, group)

  await gotoGroup(page, group)

  await createThread(page, group)

  // GOTO THREAD

  await page.getByPlaceholder('Write a comment...').click()
  await page.getByPlaceholder('Write a comment...').fill('Test Comment')
  await page.locator('button[type="submit"]').first().click()
  await page.getByRole('button', { name: 'Reply' }).click()
  await page.getByPlaceholder('Write a comment...').nth(1).click()
  await page.getByPlaceholder('Write a comment...').nth(1).fill('Test Reply with file')
  await page.locator('button[type="submit"]').nth(1).click()

  //TODO: Test images in comment
  // Test multiple users
  // TODO Test likes
})

test('Thread-Create-Report-Delete', async ({ page, user }) => {
  await login(page, user)

  const group = { name: 'Test Group Thread' + randomString(), public: false }

  await createGroup(page, group)

  await gotoGroup(page, group)

  await createThread(page, group)

  await page.getByPlaceholder('Write a comment...').click()
  await page.getByPlaceholder('Write a comment...').fill('Test Comment')
  await page.locator('button[type="submit"]').first().click()
  await page.getByRole('button', { name: 'Reply' }).click()
  await page.getByPlaceholder('Write a comment...').nth(1).click()
  await page.getByPlaceholder('Write a comment...').nth(1).fill('Test Reply with file')
  await page.locator('button[type="submit"]').nth(1).click()

  //TODO Test images in comment

  await page.locator('#poll-header-multiple-choices > button').click()
  await page.getByRole('button', { name: 'Report Thread' }).click()
  await page.getByRole('textbox', { name: 'Title' }).click()
  await page.getByRole('textbox', { name: 'Title' }).fill('Report Test')
  await page.locator('#report-description').click()
  await page.locator('#report-description').fill('This is a test report')
  await page.getByRole('button', { name: 'Report', exact: true }).click()
  await expect(page.getByText('Thread reported successfully')).toBeVisible()
  await page.waitForTimeout(500)
  // Dropdown stays open after report — click Delete Thread directly
  await page.getByRole('button', { name: 'Delete Thread' }).click()
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.waitForTimeout(300)
  // After cancel, check if dropdown is visible or needs toggling
  const deleteBtn = page.getByRole('button', { name: 'Delete Thread' })
  if (!(await deleteBtn.isVisible())) {
    await page.locator('#poll-header-multiple-choices > button').click()
    await page.waitForTimeout(300)
  }
  await deleteBtn.click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.getByText('Successfully deleted thread')).toBeVisible()
})
