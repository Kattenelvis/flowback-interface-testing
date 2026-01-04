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

    await login(bPage, { email: process.env.SECONDUSER_MAIL, password: process.env.SECONDUSER_PASS })
    await joinGroup(bPage, group)

    await page.waitForTimeout(1000)
    await bPage.getByRole('button', { name: 'Delegations' }).click()
    // await bPage.locator('#delegate-group-select').selectOption({ label: group.name });
    await bPage.getByRole('textbox', { name: '0/' }).click()
    await bPage.getByRole('textbox', { name: '0/' }).fill(group.name)

    await page.waitForTimeout(1000)
    await bPage.getByRole('button', { name: 'Uncategorised' }).click()
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

    await fastForward(page, 1)

    const proposal = { title: 'Proposal 1', vote: 3 }
    await createProposal(page, proposal)

    await fastForward(page, 3)

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
