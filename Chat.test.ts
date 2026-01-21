import { test, expect, firefox, chromium } from '@playwright/test'
import { login, newWindow, randomString, register } from './generic'
import { createGroup, deleteGroup, gotoGroup, joinGroup } from './group'
import 'dotenv/config'

test('Group-Chat', async ({ page }) => {
  await login(page)

  const group = { name: 'test-group-chat' + randomString(), public: true }

  await createGroup(page, group)

  const bPage = await newWindow()
  await login(bPage, {
    email: process.env.SECONDUSER_MAIL,
    password: process.env.SECONDUSER_PASS,
  })
  await joinGroup(bPage, group)

  await page.reload()
  await bPage.reload()

  await page.getByRole('button', { name: 'open chat' }).click()
  await page.getByPlaceholder('Search chatters').click()
  await page.getByPlaceholder('Search chatters').fill(group.name)
  await page
    .getByRole('button', { name: `avatar ${group.name}` })
    .first()
    .click()

  await page.getByPlaceholder('Write a message...').click()
  await page.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await page.waitForTimeout(300)
  await page.locator('form > button:nth-child(2)').click()
  await page.getByPlaceholder('Write a message...').click()
  await page.waitForTimeout(300)

  await bPage.getByRole('button', { name: 'open chat' }).click()
  await bPage.getByPlaceholder('Search chatters').click()
  await bPage.getByPlaceholder('Search chatters').fill(group.name)
  await bPage.getByRole('button', { name: group.name }).first().click()
  await page.waitForTimeout(300)
  await bPage.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await bPage.getByPlaceholder('Write a message...').press('Enter')
  await page.waitForTimeout(300)

  await expect(page.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(page.getByText('Hello!! :D').nth(2)).toBeVisible()

  await expect(bPage.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(bPage.getByText('Hello!! :D').nth(2)).toBeVisible()

  await gotoGroup(page, group)
  await deleteGroup(page, group)
})

test('Direct-Chat-Via-Group', async ({ page }) => {
  await login(page)

  const group = { name: 'Test Group Chat 2' + randomString(), public: true }

  await createGroup(page, group)

  const browser = await chromium.launch()
  const bContext = await browser.newContext()
  const bPage = await bContext.newPage()

  await login(bPage, {
    email: process.env.SECONDUSER_MAIL,
    password: process.env.SECONDUSER_PASS,
  })
  await joinGroup(bPage, group)
  await gotoGroup(bPage, group)

  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.locator('.text-primary').click()

  await page.getByPlaceholder('Write a message...').click()
  await page.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await page.locator('form > button:nth-child(2)').click()
  await page.getByPlaceholder('Write a message...').click()

  await bPage.getByRole('button', { name: 'Members', exact: true }).click()
  await bPage.locator('.text-primary').click()
  await bPage.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await bPage.getByPlaceholder('Write a message...').press('Enter')

  await expect(page.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(page.getByText('Hello!! :D').nth(2)).toBeVisible()

  await expect(bPage.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(bPage.getByText('Hello!! :D').nth(2)).toBeVisible()

  await page.getByRole('button', { name: 'Close modal' }).click()

  await deleteGroup(page, group)
})

test('Workgroup-Chat', async ({ page }) => {
  await login(page)

  const group = {
    name: 'Test Group Chat Workgroup' + randomString(),
    public: true,
  }

  await createGroup(page, group)

  const bPage = await newWindow()

  await login(bPage, {
    email: process.env.SECONDUSER_MAIL,
    password: process.env.SECONDUSER_PASS,
  })
  await joinGroup(bPage, group)
  await gotoGroup(bPage, group)

  await page.getByRole('button', { name: 'Work Groups' }).click()
  await page.getByRole('button', { name: '+ Add Workgroup' }).click()
  await page.getByLabel('Name').click()

  const workgroup = 'Workgroup for chatting in yay' + randomString()
  await page.getByLabel('Name').fill(workgroup)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('button', { name: 'Join', exact: true }).click()

  await bPage.getByRole('button', { name: 'Work Groups' }).click()
  await bPage.getByRole('button', { name: 'Join', exact: true }).click()

  await page.reload()
  await page.getByRole('button', { name: 'open chat' }).click()

  await page.getByPlaceholder('Search chatters').click()
  await page.getByPlaceholder('Search chatters').fill(workgroup)
  await page.getByRole('button', { name: workgroup }).click()
  await page.getByPlaceholder('Write a message...').click()
  await page.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await page.locator('form > button:nth-child(2)').click()
  await page.getByPlaceholder('Write a message...').click()

  await bPage.reload();

  await bPage.getByRole('button', { name: 'open chat' }).click()
  await bPage.getByPlaceholder('Search chatters').click()
  await bPage.getByPlaceholder('Search chatters').fill(workgroup)

  const chatButton = page.getByRole('button', { name: workgroup })
  await expect(chatButton).toBeVisible()
  await bPage.getByRole('button', { name: workgroup }).click()
  await bPage.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await bPage.getByPlaceholder('Write a message...').press('Enter')

  await expect(page.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(page.getByText('Hello!! :D').nth(2)).toBeVisible()

  await expect(bPage.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(bPage.getByText('Hello!! :D').nth(2)).toBeVisible()

  await page.getByRole('button', { name: 'Close modal' }).click()
})

// TODO Fix this, will require finessing with registring new users
test('Group-Chat-Creation', async ({ page }) => {
  await login(page)

  // Testing error functionality
  await page.getByRole('button', { name: 'open chat' }).click()
  await page.getByRole('button', { name: '+ New Group' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: '+ New Group' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText('Failed to created group chat')).toBeVisible()

  // Have other users chat
  const bPage = await newWindow()
  await login(bPage, {
    email: process.env.SECONDUSER_MAIL,
    password: process.env.SECONDUSER_PASS,
  })

  const cPage = await newWindow()
  // TODO: Fix so a recently registered account is also included
  // const { username } = await register(cPage)

  const username = 'c'
  await login(cPage, {
    email: "c@c.se",
    password: "c"
  })

  await page.getByRole('button', { name: 'avatar + Invite user' }).nth(1).click()
  await page.getByRole('textbox', { name: 'User to invite' }).click()
  await page.getByRole('textbox', { name: 'User to invite' }).fill(username)
  await page.getByRole('button', { name: 'Add Me!', exact: true }).click()
  await page.getByRole('button', { name: 'Close modal' }).nth(3).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Failed to created group chat')).not.toBe

  const groupname = `${process.env.MAINUSER_NAME}, ${process.env.SECONDUSER_NAME}, ${username}`
  // Write messages and check that they are visible
  await page.getByPlaceholder('Write a message...').click()
  await page.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await page.waitForTimeout(300)
  await page.locator('form > button:nth-child(2)').click()
  await page.getByPlaceholder('Write a message...').click()
  await page.waitForTimeout(300)

  await bPage.getByRole('button', { name: 'open chat' }).click()
  await bPage.getByPlaceholder('Search chatters').click()
  await bPage.getByPlaceholder('Search chatters').fill(groupname)
  await bPage.getByRole('button', { name: groupname }).first().click()
  await page.waitForTimeout(300)
  await bPage.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await bPage.getByPlaceholder('Write a message...').press('Enter')
  await page.waitForTimeout(300)

  await cPage.getByRole('button', { name: 'open chat' }).click()
  await cPage.getByPlaceholder('Search chatters').click()
  await cPage.getByPlaceholder('Search chatters').fill(groupname)
  await cPage.getByRole('button', { name: groupname }).first().click()
  await page.waitForTimeout(300)
  await cPage.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await cPage.getByPlaceholder('Write a message...').press('Enter')
  await page.waitForTimeout(300)

  await expect(page.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(page.getByText('Hello!! :D').nth(2)).toBeVisible()
  await expect(page.getByText('Hello!! :D').nth(3)).toBeVisible()

  await expect(bPage.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(bPage.getByText('Hello!! :D').nth(2)).toBeVisible()
  await expect(bPage.getByText('Hello!! :D').nth(3)).toBeVisible()

  await expect(cPage.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(cPage.getByText('Hello!! :D').nth(2)).toBeVisible()
  await expect(cPage.getByText('Hello!! :D').nth(3)).toBeVisible()
})
