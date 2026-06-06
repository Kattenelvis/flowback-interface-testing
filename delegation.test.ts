import { test, chromium, expect } from '@playwright/test'
import { login, newWindow, randomString, register } from './generic'
import { createPoll, createProposal, fastForward, goToPost, vote } from './poll'
import { createGroup, deleteGroup, gotoGroup, joinGroup } from './group'
import { becomeDelegate, delegateToUser } from './delegation'
import { idfy } from './generic'
import 'dotenv/config'
import { assignPermission, createPermission } from './permission'

test('Become-Delegate', async ({ page }) => {
  await login(page)

  const group = { name: 'Test Group Delegation ' + randomString(), public: true }

  await createGroup(page, group)

  await page.waitForTimeout(300)

  await becomeDelegate(page, group)
})

test('Delegation-Poll', async ({ page }) => {
  await login(page)

  const group = { name: 'Test Group Delegation' + randomString(), public: true }

  await createGroup(page, group)

  const bPage = await newWindow()

  await page.waitForTimeout(300)

  await becomeDelegate(page, group)

  await login(bPage, { username: process.env.SECONDUSER_NAME, password: process.env.SECONDUSER_PASS })
  await joinGroup(bPage, group)

  await page.waitForTimeout(1000)
  await bPage.getByRole('button', { name: 'Delegation', exact: true }).click()
  // await bPage.locator('#delegate-group-select').selectOption({ label: group.name });
  await bPage.getByRole('textbox', { name: '0/' }).click()
  await bPage.getByRole('textbox', { name: '0/' }).fill(group.name)

  await page.waitForTimeout(1000)
  await expect(bPage.getByText("There are currently no delegates for this group")).not.toBeVisible()
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

test('Delegate-History', async ({ page }) => {
  await login(page)

  const group = { name: 'Test Group Delegate History ' + randomString(), public: true }

  await createGroup(page, group)
  await becomeDelegate(page, group)

  // Navigation: verify delegate management flow
  await expect(page.getByRole('heading', { name: 'Manage Delegations' })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByText('Delegates')).toBeVisible()

  // Create poll and vote so history has data
  await gotoGroup(page, group)
  const poll = { title: 'Test Poll History ' + randomString(), phase_time: 1 }
  await createPoll(page, poll)
  const proposal = { title: 'Proposal History ' + randomString(), vote: 3 }
  await createProposal(page, proposal)
  await fastForward(page, 2)
  await vote(page, proposal)
  await fastForward(page, 2)
  await page.waitForTimeout(4000)

  await fastForward(page, 1)
  await page.waitForTimeout(4000)
  // Navigate to delegate history for this group
  await page.goto(`${process.env.LINK}/delegations`)
  await page.getByRole('textbox', { name: '0/' }).fill(group.name)
  await page.waitForTimeout(1000)
  await page.getByRole('link', { name: 'History' }).first().click()
  await expect(page.getByText(/Delegate history for/)).toBeVisible()

  // Shows-Vote: verify poll and vote entry appear
  await expect(page.getByRole('link', { name: poll.title })).toBeVisible()
  await expect(page.getByText(/Delegate voted:/)).toBeVisible()

  // Search: non-existent poll returns empty
  await page.getByPlaceholder('Search polls').fill('nonexistentpoll__xyz__12345')
  await page.getByPlaceholder('Search polls').dispatchEvent('input')
  await page.waitForTimeout(1000)
  await expect(page.locator('ul > li')).toHaveCount(0)

  // Reset filter
  await page.getByRole('button', { name: 'Reset Filter' }).click()
  await page.waitForTimeout(300)
  await expect(page.getByPlaceholder('Search polls')).toHaveValue('')

  // Sort: Z-A then A-Z
  const sortCombobox = page.getByRole('combobox').first()
  await sortCombobox.selectOption('Z - A')
  await page.waitForTimeout(300)
  await expect(sortCombobox).toHaveValue('z-a')
  await sortCombobox.selectOption('A - Z')
  await page.waitForTimeout(300)
  await expect(sortCombobox).toHaveValue('a-z')

  // Poll link: click through and verify URL
  const firstItem = page.locator('ul > li').first()
  await expect(firstItem).toBeVisible()
  await firstItem.getByRole('link').first().click()
  await expect(page).toHaveURL(/source=delegate-history/)

  await gotoGroup(page, group)
  await deleteGroup(page, group)
})

test('Delegation-Override-Results', async ({ page }) => {
  test.setTimeout(0)
  await login(page)

  const group = { name: 'Test Group Delegation Override ' + randomString(), public: true }
  const poll = { title: 'Test Poll Delegation Override ' + randomString() }
  const proposalOne = { title: 'Proposal 1 ' + randomString(), vote: 3 }
  const proposalTwo = { title: 'Proposal 2 ' + randomString(), vote: 2 }
  const proposalThree = { title: 'Proposal 3 ' + randomString(), vote: 1 }

  const bPage = await newWindow()
  const cPage = await newWindow()
  const dPage = await newWindow()

  await login(cPage, { username: process.env.THIRDUSER_NAME, password: process.env.THIRDUSER_PASS })
  await login(bPage, { username: process.env.SECONDUSER_NAME, password: process.env.SECONDUSER_PASS })
  await login(dPage, { username: process.env.FOURTHUSER_NAME, password: process.env.FOURTHUSER_PASS })

  await createGroup(page, group)

  await joinGroup(cPage, group)
  await becomeDelegate(cPage, group)

  await delegateToUser(page, group)

  await joinGroup(bPage, group)
  await delegateToUser(bPage, group)

  // D joins with empty permission (no voting rights)
  await joinGroup(dPage, group)
  await gotoGroup(page, group)
  await page.getByRole('button', { name: 'Edit Group' }).dispatchEvent('click')
  const emptyPermission = 'No Voting ' + randomString()
  await createPermission(page, group, [], emptyPermission)
  await assignPermission(page, group, emptyPermission, process.env.FOURTHUSER_NAME)

  await gotoGroup(page, group)
  await createPoll(page, poll)
  await createProposal(page, proposalOne)
  await createProposal(page, proposalTwo)
  await createProposal(page, proposalThree)

  await goToPost(page, poll)
  await goToPost(cPage, poll)

  await fastForward(page, 2)

  await cPage.reload()
  await vote(cPage, { title: proposalOne.title, vote: 1 })
  await vote(cPage, { title: proposalTwo.title, vote: 3 })
  await vote(cPage, { title: proposalThree.title, vote: 1 })

  // A's vote should be disabled (not a delegate)
  await page.reload()
  await expect(page.locator(`#track-container-${idfy(proposalOne.title)}`)).toContainClass('disabled')

  // D's vote should be disabled (no voting permission)
  await goToPost(dPage, poll)
  await dPage.reload()
  await expect(dPage.locator(`#track-container-${idfy(proposalOne.title)}`)).toContainClass('disabled')
  await expect(dPage.getByText("You are not allowed to vote")).toBeVisible()

  await expect(cPage.getByText('Vote Failed').first()).not.toBeVisible()
  await fastForward(page, 1)

  // TODO: Get vote: 0 to work
  // await vote(page, { title: proposalTwo.title, vote: 0 })
  await vote(cPage, { title: proposalOne.title, vote: 5 })
  await vote(page, { title: proposalOne.title, vote: 5 })

  await page.reload()
  await vote(page, { title: proposalOne.title, vote: 3 })
  await vote(page, { title: proposalTwo.title, vote: 4 })

  await vote(cPage, { title: proposalTwo.title, vote: 5 })
  // Delegates should be able to vote in normal vote phase
  await expect(cPage.getByText('Vote Failed').first()).not.toBeVisible()
  await fastForward(page, 1)

  await expect(page.getByText('Results', { exact: true })).toBeVisible()

  const resultOne = page.locator('div.border-gray-300.border-b-2').filter({ hasText: proposalOne.title }).first()
  const resultTwo = page.locator('div.border-gray-300.border-b-2').filter({ hasText: proposalTwo.title }).first()
  const resultThree = page.locator('div.border-gray-300.border-b-2').filter({ hasText: proposalThree.title }).first()

  await expect(resultOne).toContainText('Points: 9')
  await expect(resultTwo).toContainText('Points: 12')
  await expect(resultThree).toContainText('Points: 3')
})
