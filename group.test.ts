import { test, expect, type Response } from './fixtures'
import { expectOkResponse, idfy, login, newWindow, randomString, responseMatches, createUser, loginAsNewUser, type TestUser } from './generic'
import { createGroup, deleteGroup, gotoFirstGroup, gotoGroup, joinGroup } from './group'
import { createPermission } from './permission'

// TODO: Add test for this situation:
// User a creates a group which is invite only
// User b asks to join
// User a accepts b's request to join
// User b leaves the group
// User b asks to join again
// User a tries to reject, but it says error 400, "User already joined"

test.describe('Group-Integration-Tests', () => {
  test.describe.configure({ mode: 'serial' })
  const group = { name: 'Test Group Group-Testing Public' + randomString(), public: true, invite: false }
  // Serial block shares one owner + member across its tests.
  let owner: TestUser
  let member: TestUser

  test.beforeAll(async () => {
    owner = await createUser()
    member = await createUser()
  })

  test('Create Group', async ({ page }) => {
    await login(page, owner)
    await createGroup(page, group)
  })

  test('Go To Group', async ({ page }) => {
    await login(page, owner)
    await gotoGroup(page, group)
  })

  test('Join Group', async ({ page }) => {
    await login(page, member)
    await joinGroup(page, group)
  })

  test('Leave Group', async ({ page }) => {
    await login(page, member)
    await gotoGroup(page, group)
    await page.getByRole('button', { name: 'Leave group' }).click()
    await page.getByRole('button', { name: 'Yes', exact: true }).click()
  })

  test('Delete Group', async ({ page }) => {
    await login(page, owner)
    await gotoGroup(page, group)
    await deleteGroup(page)
  })
})

test.describe('Create-Delete-Group Invite only', () => {
  test.describe.configure({ mode: 'serial' })
  const groupInvite = { name: 'Test Group Group-Testing Invite only' + randomString(), public: true, invite: true }
  let owner: TestUser
  let member: TestUser

  test.beforeAll(async () => {
    owner = await createUser()
    member = await createUser()
  })

  test('Create Group Invite', async ({ page }) => {
    await login(page, owner)
    await createGroup(page, groupInvite)
  })

  test('Go To Group Invite', async ({ page }) => {
    await login(page, owner)
    await gotoGroup(page, groupInvite)
  })

  test('Ask to Join Group Invite', async ({ page }) => {
    await login(page, owner)
    const bPage = await newWindow()
    await login(bPage, member)
    await joinGroup(bPage, groupInvite)

    await gotoGroup(page, groupInvite)
    await page.getByRole('button', { name: 'Members', exact: true }).click()
    await page.getByRole('button', { name: 'Accept' }).click()

    await gotoGroup(bPage, groupInvite)
  })

  test('Leave Group Invite', async ({ page }) => {
    const bPage = await newWindow()
    await login(bPage, member)
    await gotoGroup(bPage, groupInvite)
    await bPage.getByRole('button', { name: 'Leave group' }).click()
    await bPage.getByRole('button', { name: 'Yes', exact: true }).click()
  })

  test('Delete Group Invite', async ({ page }) => {
    await login(page, owner)
    await gotoGroup(page, groupInvite)
    await deleteGroup(page)
  })
})

test('Group-Invite', async ({ page, user }) => {
  test.setTimeout(120000)
  const group = { name: 'Invitation ' + randomString() }
  await login(page, user)
  await createGroup(page, group)
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.getByRole('button', { name: 'avatar + Invite user' }).click()
  const bPage = await newWindow()
  const userB = await loginAsNewUser(bPage)
  await page.getByRole('textbox', { name: 'User to invite' }).click()
  await page.getByRole('textbox', { name: 'User to invite' }).fill(userB.username)
  await expect(page.getByRole('listitem').getByRole('button')).toBeVisible()
  const inviteResponse = page.waitForResponse((response: Response) =>
    responseMatches(response, 'POST', /\/group\/\d+\/invite$/),
  )
  await page.getByRole('listitem').getByRole('button').dispatchEvent('click')
  await expectOkResponse(await inviteResponse, 'Send group invite')

  await bPage.goto(`${process.env.LINK}/home`)
  await bPage.getByText(`You have been invited to ${group.name} Accept Reject`).getByText('Reject').click()

  await page.getByRole('textbox', { name: 'User to invite' }).click()
  await page.getByRole('textbox', { name: 'User to invite' }).fill(userB.username)
  await expect(page.getByRole('listitem').getByRole('button')).toBeVisible()
  const reinviteResponse = page.waitForResponse((response: Response) =>
    responseMatches(response, 'POST', /\/group\/\d+\/invite$/),
  )
  await page.getByRole('listitem').getByRole('button').dispatchEvent('click')
  await expectOkResponse(await reinviteResponse, 'Resend group invite')

  await bPage.reload()
  await bPage.getByText(`You have been invited to ${group.name} Accept Reject`).getByText('Accept').click()

  await gotoGroup(bPage, group)
})

test('Create-Delete-Group', async ({ page, user }) => {
  await login(page, user)

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
  const directWorkGroup = page.locator('[id="Test Workgroup directjoin"]')
  await expect(directWorkGroup).toBeVisible()
  await directWorkGroup.getByRole('button').last().click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await directWorkGroup.getByRole('button').last().click()
  const directWorkGroupDeleteResponse = page.waitForResponse((response: Response) =>
    responseMatches(response, 'POST', /\/group\/workgroup\/\d+\/delete$/),
  )
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expectOkResponse(await directWorkGroupDeleteResponse, 'Delete direct workgroup')
  const inviteOnlyWorkGroup = page.locator('[id="Test group invite only"]')
  await expect(inviteOnlyWorkGroup).toBeVisible()
  await inviteOnlyWorkGroup.getByRole('button').last().click()
  const inviteOnlyWorkGroupDeleteResponse = page.waitForResponse((response: Response) =>
    responseMatches(response, 'POST', /\/group\/workgroup\/\d+\/delete$/),
  )
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expectOkResponse(await inviteOnlyWorkGroupDeleteResponse, 'Delete invite-only workgroup')

  // Editing Group
  await expect(page.locator('#group-header-title')).toHaveText(group.name)
  await page.getByRole('button', { name: 'Edit Group' }).click()

  // Create, deactive and delete permission
  await createPermission(page, group, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

  await page.getByRole('button', { name: 'Assign' }).click()
  await page.getByRole('button', { name: 'List' }).click()
  await page.locator('[id="delete-permission-button Test Permission"]').click()
  await page.getByRole('button', { name: 'Delete', exact: true }).nth(1).click()

  await deleteGroup(page, group)
})
