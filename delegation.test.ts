import { test, chromium, expect } from '@playwright/test'
import { register, newWindow, randomString } from './generic'
import { createPoll, createProposal, fastForward, goToPost, vote, waitForPhase } from './poll'
import { createGroup, deleteGroup, gotoGroup, joinGroup } from './group'
import { becomeDelegate, delegateToUser } from './delegation'
import { idfy } from './generic'
import 'dotenv/config'
import { assignPermission, createPermission } from './permission'

test('Become-Delegate', async ({ page }) => {
  await register(page)

  const group = { name: 'Test Group Delegation ' + randomString(), public: true }

  await createGroup(page, group)

  await becomeDelegate(page, group)
})

test('Delegation-Poll', async ({ page }) => {
  test.setTimeout(60000)
  await register(page)

  const group = { name: 'Test Group Delegation' + randomString(), public: true }

  await createGroup(page, group)

  const bPage = await newWindow()

  await becomeDelegate(page, group)

  const b = await register(bPage)
  await joinGroup(bPage, group)

  await bPage.getByRole('button', { name: 'Delegation', exact: true }).click()
  // await bPage.locator('#delegate-group-select').selectOption({ label: group.name });
  await bPage.getByRole('textbox', { name: '0/' }).click()
  await bPage.getByRole('textbox', { name: '0/' }).fill(group.name)

  await expect(bPage.getByText("There are currently no delegates for this group")).not.toBeVisible()
  await expect(bPage.getByRole('radio').first()).toBeVisible()
  await bPage.getByRole('radio').first().check()
  await expect(bPage.getByRole('radio').first()).toBeChecked()

  await gotoGroup(page, group)
  await page.getByRole('button', { name: 'Edit Group' }).dispatchEvent('click')
  //Give b voting rights
  const permission_name = 'Test Permission' + randomString()
  await createPermission(page, group, [2], permission_name)
  await assignPermission(page, group, permission_name, b.username)

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
  await register(page)

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
  await fastForward(page, 1)

  // Delegate history is populated asynchronously (celery), so reload the
  // delegations page and reopen the group's history until the entry arrives.
  await expect(async () => {
    await page.goto(`${process.env.LINK}/delegations`)
    await page.getByRole('textbox', { name: '0/' }).fill(group.name)
    await page.getByRole('link', { name: 'History' }).first().click()
    await expect(page.getByText(/Delegate history for/)).toBeVisible({ timeout: 3000 })
    // Shows-Vote: verify poll and vote entry appear
    await expect(page.getByRole('link', { name: poll.title })).toBeVisible({ timeout: 3000 })
  }).toPass()
  await expect(page.getByText(/Delegate voted:/)).toBeVisible()

  // Search: non-existent poll returns empty
  await page.getByPlaceholder('Search polls').fill('nonexistentpoll__xyz__12345')
  await page.getByPlaceholder('Search polls').dispatchEvent('input')
  await expect(page.locator('ul > li')).toHaveCount(0)

  // Reset filter
  await page.getByRole('button', { name: 'Reset Filter' }).click()
  await expect(page.getByPlaceholder('Search polls')).toHaveValue('')

  // Sort: Z-A then A-Z
  const sortCombobox = page.getByRole('combobox').first()
  await sortCombobox.selectOption('Z - A')
  await expect(sortCombobox).toHaveValue('z-a')
  await sortCombobox.selectOption('A - Z')
  await expect(sortCombobox).toHaveValue('a-z')

  // Poll link: click through and verify URL
  const firstItem = page.locator('ul > li').first()
  await expect(firstItem).toBeVisible()
  await firstItem.getByRole('link').first().click()
  await expect(page).toHaveURL(/source=delegate-history/)
})

test('Delegation-Override-Results', async ({ page }) => {
  // 4 users, full delegation + permission + multi-phase voting flow. ~45s
  // locally, so 60s tipped over the edge under slower CI load.
  test.setTimeout(120000)
  await register(page)

  const group = { name: 'Test Group Delegation Override ' + randomString(), public: true }
  const poll = { title: 'Test Poll Delegation Override ' + randomString() }
  const proposalOne = { title: 'Proposal 1 ' + randomString(), vote: 3 }
  const proposalTwo = { title: 'Proposal 2 ' + randomString(), vote: 2 }
  const proposalThree = { title: 'Proposal 3 ' + randomString(), vote: 1 }

  const bPage = await newWindow()
  const cPage = await newWindow()
  const dPage = await newWindow()

  const c = await register(cPage)
  const b = await register(bPage)
  const d = await register(dPage)

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
  await assignPermission(page, group, emptyPermission, d.username)

  await gotoGroup(page, group)
  await createPoll(page, poll)
  await createProposal(page, proposalOne)
  await createProposal(page, proposalTwo)
  await createProposal(page, proposalThree)

  await goToPost(page, poll)
  await goToPost(cPage, poll)

  await fastForward(page, 2)

  // Wait until cPage actually reflects the delegate-voting phase (it advanced
  // server-side via the fastForward above), then confirm every proposal track
  // has rendered before voting — under CI load proposal 3 sometimes lagged.
  await waitForPhase(cPage, /Delegate voting/)
  // The timeline flips to delegate-voting before the proposal list finishes
  // fetching, so a single check races the render (proposal 3 lagged on CI).
  // Reload-retry until every track has rendered.
  await expect(async () => {
    await cPage.reload()
    for (const proposal of [proposalOne, proposalTwo, proposalThree])
      await expect(cPage.locator(`#track-container-${idfy(proposal.title)}`)).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 30000 })

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

  // Reload so cPage/page pick up the new (non-delegate) vote phase — otherwise the
  // phase is still delegate_vote. waitForPhase reload-retries until it's there
  // instead of a single reload + flaky networkidle wait.
  // Ideally we'd eventually fix this with frontend polling on poll phase or events sent from backend or something
  await waitForPhase(cPage, /Voting for non-delegates/)
  await waitForPhase(page, /Voting for non-delegates/)

  // TODO: Get vote: 0 to work
  // await vote(page, { title: proposalTwo.title, vote: 0 })
  await vote(cPage, { title: proposalOne.title, vote: 5 })
  await vote(page, { title: proposalOne.title, vote: 5 })

  await waitForPhase(page, /Voting for non-delegates/)
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
