import { test, chromium, expect } from '@playwright/test'
import { login, randomString } from './generic'
import { createPoll, createProposal, fastForward, goToPost, vote } from './poll'
import { createGroup, deleteGroup, gotoGroup, joinGroup } from './group'
import { becomeDelegate } from './delegation'
import { idfy } from './generic'
import 'dotenv/config'
import { assignPermission, createPermission } from './permission'

test('Become-Delegate', async ({ page }) => {
  await login(page)

  const group = { name: 'Test Group Delegation ' + randomString(), public: true }

  await createGroup(page, group)

  await becomeDelegate(page, group)

  await gotoGroup(page, group)
  await deleteGroup(page, group)
})

test('Delegation-Poll', async ({ page }) => {
  await login(page)

  const group = { name: 'Test Group Delegation' + randomString(), public: true }

  await createGroup(page, group)

  await page.waitForTimeout(300)

  await becomeDelegate(page, group)

  const browser = await chromium.launch()
  const bContext = await browser.newContext()
  const bPage = await bContext.newPage()

  await login(bPage, { username: process.env.SECONDUSER_NAME, password: process.env.SECONDUSER_PASS })
  await joinGroup(bPage, group)

  await page.waitForTimeout(1000)
  await bPage.getByRole('button', { name: 'Delegation', exact: true }).click()
  // await bPage.locator('#delegate-group-select').selectOption({ label: group.name });
  await bPage.getByRole('textbox', { name: '0/' }).click()
  await bPage.getByRole('textbox', { name: '0/' }).fill(group.name)

  await page.waitForTimeout(1000)
  await bPage.getByRole('radio').first().check()
  await page.waitForTimeout(1000)

  await gotoGroup(page, group)
  await page.getByRole('button', { name: 'Edit Group' }).dispatchEvent('click')
  //Give b voting rights
  const permission_name = 'Test Permission' + randomString()
  await createPermission(page, group, [2], permission_name)
  await assignPermission(page, group, permission_name, process.env.SECONDUSER_NAME)

  await gotoGroup(page, group)

  const poll = { title: `Test Poll for Delegation` + randomString() }
  await createPoll(page, poll)

  const proposal = { title: 'Proposal 1', vote: 3 }
  await createProposal(page, proposal)

  await fastForward(page, 2)

  await vote(page, proposal)

  await goToPost(bPage, poll)

  await expect(page.getByText('Vote Failed').first()).not.toBeVisible()
  await expect(bPage.locator(`#track-container-${idfy(proposal.title)}`)).toContainClass('disabled')
  await expect(page.locator(`#track-container-${idfy(proposal.title)}`)).not.toContainClass('disabled')

  // await fastForward(page, 2);

  // await bPage.reload();
  // await expect(bPage.locator(`#track-container-${idfy(proposal.title)}`)).not.toContainClass('disabled')
  // await expect(page.locator(`#track-container-${idfy(proposal.title)}`)).not.toContainClass('disabled')
})

test('Delegate-History-Navigation', async ({ page }) => {
  await login(page)

  await page.goto(`${process.env.LINK}/delegations`)
  await expect(page.getByRole('heading', { name: 'Manage Delegations' })).toBeVisible()
  await expect(page.getByText('Delegates')).toBeVisible()

  // Click the History link for the first visible delegate
  await page.getByRole('link', { name: 'History' }).first().click()

  // Verify the delegate history page loaded
  await expect(page.getByText(/Delegate history for/)).toBeVisible()
})

test('Delegate-History-Search', async ({ page }) => {
  await login(page)

  await page.goto(`${process.env.LINK}/delegations`)
  await page.getByRole('link', { name: 'History' }).first().click()
  await expect(page.getByText(/Delegate history for/)).toBeVisible()

  // Search for a non-existent poll - list should become empty
  await page.getByPlaceholder('Search polls').fill('nonexistentpoll__xyz__12345')
  await page.getByPlaceholder('Search polls').dispatchEvent('input')
  await page.waitForTimeout(1000)
  await expect(page.locator('ul > li')).toHaveCount(0)

  // Reset filter and verify the search is cleared
  await page.getByRole('button', { name: 'Reset Filter' }).click()
  await page.waitForTimeout(300)
  await expect(page.getByPlaceholder('Search polls')).toHaveValue('')
})

test('Delegate-History-Sort', async ({ page }) => {
  await login(page)

  await page.goto(`${process.env.LINK}/delegations`)
  await page.getByRole('link', { name: 'History' }).first().click()
  await expect(page.getByText(/Delegate history for/)).toBeVisible()

  // Change sort to Z-A and verify (first combobox is the poll sort, second is comments sort)
  const sortCombobox = page.getByRole('combobox').first()
  await sortCombobox.selectOption('Z - A')
  await page.waitForTimeout(300)
  await expect(sortCombobox).toHaveValue('z-a')

  // Change back to A-Z and verify
  await sortCombobox.selectOption('A - Z')
  await page.waitForTimeout(300)
  await expect(sortCombobox).toHaveValue('a-z')
})

test('Delegate-History-Poll-Link', async ({ page }) => {
  await login(page)

  await page.goto(`${process.env.LINK}/delegations`)
  await page.getByRole('link', { name: 'History' }).first().click()
  await expect(page.getByText(/Delegate history for/)).toBeVisible()

  // Verify history entries exist and click the first poll link
  const firstItem = page.locator('ul > li').first()
  await expect(firstItem).toBeVisible()
  await firstItem.getByRole('link').first().click()

  // Verify the URL contains the delegate-history source parameter
  await expect(page).toHaveURL(/source=delegate-history/)
})

test('Delegate-History-Shows-Vote', async ({ page }) => {
  await login(page)

  const group = { name: 'Test Group Delegate History ' + randomString(), public: true }

  await createGroup(page, group)
  await becomeDelegate(page, group)

  await gotoGroup(page, group)

  const poll = { title: 'Test Poll History ' + randomString(), phase_time: 1 }
  await createPoll(page, poll)

  await fastForward(page, 1)

  const proposal = { title: 'Proposal History ' + randomString(), vote: 3 }
  await createProposal(page, proposal)

  await fastForward(page, 3)

  await vote(page, proposal)

  // Navigate to the delegation page and find the group's delegate history
  await page.goto(`${process.env.LINK}/delegations`)
  await page.getByRole('textbox', { name: '0/' }).fill(group.name)
  await page.waitForTimeout(1000)

  // Click History for the delegate (user "a" who became a delegate in this group)
  await page.getByRole('link', { name: 'History' }).first().click()
  await expect(page.getByText(/Delegate history for/)).toBeVisible()

  // Verify the poll appears in the delegate's voting history
  await expect(page.getByRole('link', { name: poll.title })).toBeVisible()

  // Verify the delegate vote entry is shown
  await expect(page.getByText(/Delegate voted:/)).toBeVisible()

  await gotoGroup(page, group)
  await deleteGroup(page, group)
})
