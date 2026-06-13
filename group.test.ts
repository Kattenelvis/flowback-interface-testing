import { test, expect } from '@playwright/test'
import { idfy, newWindow, randomString, register } from './generic'
import { createGroup, deleteGroup, gotoFirstGroup, gotoGroup, joinGroup } from './group'
import { createPermission } from './permission'

// TODO: Add test for this situation:
// User a creates a group which is invite only
// User b asks to join
// User a accepts b's request to join
// User b leaves the group
// User b asks to join again
// User a tries to reject, but it says error 400, "User already joined"

test('Group-Integration-Tests', async ({ page }) => {
  const group = { name: 'Test Group Group-Testing Public' + randomString(), public: true, invite: false }

  // a creates the group
  await register(page)
  await createGroup(page, group)
  await gotoGroup(page, group)

  // b joins the public group
  const bPage = await newWindow()
  await register(bPage)
  await joinGroup(bPage, group)

  // b leaves the group
  await gotoGroup(bPage, group)
  await bPage.getByRole('button', { name: 'Leave group' }).click()
  await bPage.getByRole('button', { name: 'Yes', exact: true }).click()

  // a deletes the group
  await gotoGroup(page, group)
  await deleteGroup(page)
})

test('Create-Delete-Group-Invite-Only', async ({ page }) => {
  const groupInvite = { name: 'Test Group Group-Testing Invite only' + randomString(), public: true, invite: true }

  // a creates the invite-only group
  await register(page)
  await createGroup(page, groupInvite)
  await gotoGroup(page, groupInvite)

  // b asks to join
  const bPage = await newWindow()
  await register(bPage)
  await joinGroup(bPage, groupInvite)

  // a accepts b's request
  await gotoGroup(page, groupInvite)
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.getByRole('button', { name: 'Accept' }).click()

  // b leaves the group
  await gotoGroup(bPage, groupInvite)
  await bPage.getByRole('button', { name: 'Leave group' }).click()
  await bPage.getByRole('button', { name: 'Yes', exact: true }).click()

  // a deletes the group
  await gotoGroup(page, groupInvite)
  await deleteGroup(page)
})

test('Group-Invite', async ({ page }) => {
  const group = { name: 'Invitation ' + randomString() }
  await register(page)
  await createGroup(page, group)

  // Register b up front so a can invite them by username
  const bPage = await newWindow()
  const b = await register(bPage)

  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.getByRole('button', { name: 'avatar + Invite user' }).click()
  await page.getByRole('textbox', { name: 'User to invite' }).click()
  await page.getByRole('textbox', { name: 'User to invite' }).fill(b.username)
  await page.getByRole('listitem').getByRole('button').filter({ hasText: /^$/ }).click()
  await expect(page.getByText('Successfully sent invite')).toBeVisible()

  // b refreshes to see the invite, then rejects it
  await bPage.reload()
  await bPage.getByText(`You have been invited to ${group.name} Accept Reject`).getByText('Reject').click()

  await page.getByRole('textbox', { name: 'User to invite' }).click()
  await page.getByRole('textbox', { name: 'User to invite' }).fill(b.username)

  await page.getByRole('listitem').getByRole('button').filter({ hasText: /^$/ }).click()
  await expect(page.getByText('Successfully sent invite')).toBeVisible()

  await bPage.reload()
  await bPage.getByText(`You have been invited to ${group.name} Accept Reject`).getByText('Accept').click()

  await gotoGroup(bPage, group)
})

test('Create-Delete-Group', async ({ page }) => {
  await register(page)

  const group = { name: 'Test Group Group-Test-' + randomString(), public: false }
  await createGroup(page, group)

  // Attempting to leave group as owner
  await page.getByRole('button', { name: 'Leave group' }).click()
  await page.getByRole('button', { name: 'Yes', exact: true }).click()
  await expect(page.getByText("Group owner isn't allowed to")).toBeVisible()
  await page.getByRole('button', { name: 'No', exact: true }).click()

  // Workgroup testing
  await page.getByRole('button', { name: 'Work Groups' }).click()
  await page.getByRole('button', { name: '+ Add Workgroup' }).click()
  await page.getByLabel('Name').click()
  await page.getByLabel('Name').fill('Test Workgroup directjoin')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('button', { name: 'Join', exact: true }).click()
  await page.getByRole('button', { name: '+ Add Workgroup' }).click()
  await page.getByLabel('No').check()
  await page.getByLabel('Name').click()
  await page.getByLabel('Name').fill('Test group invite only')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('button', { name: 'Ask to join' }).click()
  await expect(page.getByText('Pending')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Leave', exact: true }).nth(0)).toBeVisible()
  await page.getByRole('button', { name: 'Add User' }).nth(0).click()
  await page.getByText('Test Workgroup directjoin Members: 1').nth(0)
  await page.getByText('Test Workgroup directjoin Members: 1').nth(0).getByRole('button').nth(1).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByText('Test Workgroup directjoin Members: 1').nth(0).getByRole('button').nth(1).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.locator('.dark\\:text-darkmodeText > .text-center').nth(1).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  // Editing Group
  await expect(page.locator('#group-header-title')).toHaveText(group.name)
  await page.getByRole('button', { name: 'Edit Group' }).click()

  // Create, deactive and delete permission
  await createPermission(page, group, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

  await page.getByRole('button', { name: 'Assign' }).click()
  await page.getByRole('button', { name: 'List' }).click()
  await page.locator('[id="delete-permission-button Test Permission"]').click()
  await page.getByRole('button', { name: 'Delete', exact: true }).nth(1).click()
  // Create, deactive and delete area
  // await page.getByRole('button', { name: 'Areas' }).click()
  // await page.getByLabel('Tag').click()
  // await page.getByLabel('Tag').fill('Test Tag')
  // await page.getByLabel('Description').click()
  // await page.getByLabel('Description').fill('Test tag description')
  // await page.getByRole('button', { name: 'Add' }).click()
  // await expect(page.locator(`#test-tag`).first()).toHaveText('Test Tag')
  // await page.locator('.slider').first().click()
  // await page.locator('.text-red-500').first().click()
  // await page.getByRole('button', { name: 'No', exact: true }).click()
  // await page.locator('.text-red-500').first().click()
  // await page.getByRole('button', { name: 'Yes', exact: true }).click()
  //
  await deleteGroup(page, group)
})
