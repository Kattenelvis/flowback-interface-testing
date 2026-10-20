import test, { expect } from '@playwright/test'
import { newWindow, randomString, register } from './generic'
import { createGroup, gotoGroup, joinGroup } from './group'
import { createPoll } from './poll'
import { createThread } from './thread'

const isThreadDelete = (response: any) =>
  /\/group\/thread\/\d+\/delete$/.test(response.url()) && response.request().method() === 'POST'

test('Thread-Delete-Own-Thread-From-Feed', async ({ page }) => {
  await register(page)

  const group = { name: 'Test Group Thread Delete' + randomString(), public: false }
  await createGroup(page, group)
  await gotoGroup(page, group)

  await createThread(page, group, { title: 'Test Thread', description: 'Test Description' })

  await gotoGroup(page, group)
  const thumbnail = page.locator('#thumbnails').getByRole('button', { name: 'Test Thread', exact: true })
  await expect(thumbnail).toBeVisible()

  await page.locator('#thumbnails #multiple-choices > button').first().click()
  await page.getByRole('button', { name: 'Delete Post' }).click()

  const deleted = page.waitForResponse(isThreadDelete)
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  const response = await deleted

  expect(response.status(), `Delete responded: ${await response.text()}`).toBe(200)
  await expect(page.getByText('Successfully deleted thread')).toBeVisible()
  await expect(thumbnail).not.toBeVisible()

  await page.reload()
  await expect(page.locator('#group-header-title')).toHaveText(group.name)
  await expect(page.getByText('No posts currently here')).toBeVisible()
  await expect(thumbnail).not.toBeVisible()
})

test('Thread-Delete-Hidden-For-Other-Members', async ({ page }) => {
  const bPage = await newWindow()

  await register(page)
  await register(bPage)

  const group = { name: 'Test Group Thread Delete Other' + randomString(), public: true, invite: false }
  await createGroup(page, group)
  await gotoGroup(page, group)
  await createThread(page, group, { title: 'Test Thread', description: 'Test Description' })

  await joinGroup(bPage, group)
  await gotoGroup(bPage, group)

  await expect(bPage.locator('#thumbnails').getByRole('button', { name: 'Test Thread', exact: true })).toBeVisible()
  await bPage.locator('#thumbnails #multiple-choices > button').first().click()
  await expect(bPage.getByRole('button', { name: 'Report Post' })).toBeVisible()
  await expect(bPage.getByRole('button', { name: 'Delete Post' })).toHaveCount(0)
})

test('Poll-Delete-Hidden-For-Other-Members', async ({ page }) => {
  const bPage = await newWindow()

  await register(page)
  await register(bPage)

  const group = { name: 'Test Group Poll Delete Other' + randomString(), public: true, invite: false }
  await createGroup(page, group)
  await gotoGroup(page, group)
  await createPoll(page, { title: 'Test Poll Delete' })

  await joinGroup(bPage, group)
  await gotoGroup(bPage, group)

  await expect(bPage.locator('#thumbnails').getByRole('button', { name: 'Test Poll Delete', exact: true })).toBeVisible()
  await bPage.locator('#thumbnails #multiple-choices > button').first().click()
  await expect(bPage.getByRole('button', { name: 'Report Post' })).toBeVisible()
  await expect(bPage.getByRole('button', { name: 'Delete Post' })).toHaveCount(0)

  await gotoGroup(page, group)
  await page.locator('#thumbnails #multiple-choices > button').first().click()
  await expect(page.getByRole('button', { name: 'Delete Post' })).toBeVisible()
})
