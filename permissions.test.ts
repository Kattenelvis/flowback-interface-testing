import test, { expect } from '@playwright/test'
import { createGroup, deleteGroup, gotoGroup, joinGroup } from './group'
import { newWindow, randomString, register } from './generic'
import { assignPermission, createPermission } from './permission'
import 'dotenv/config'

// Two users: A owns a group and controls permissions, B is a member whose
// "Create a post" ability is toggled by the role A assigns.
test('Permissions', async ({ page }) => {
  // Heavy two-user flow (two registrations, two role creations, two assignments);
  // give it a larger timeout so it survives parallel load.
  test.slow()

  const group = { name: 'Test Group Permissions ' + randomString(), public: true }

  // A creates the group
  await register(page)
  await createGroup(page, group)
  await expect(page.locator('#group-header-title')).toHaveText(group.name)

  // B joins the group
  const bPage = await newWindow()
  const b = await register(bPage)
  await joinGroup(bPage, group)

  const createPostButton = bPage.locator('#create-a-post-sidebar-button')

  // A creates an empty role and a full role
  const noPermission = 'No Permissions'
  const fullPermission = 'Full Permissions'
  const allPerms = [...Array(17).keys()]

  await page.getByRole('button', { name: 'Edit Group' }).dispatchEvent('click')
  await createPermission(page, group, [], noPermission)
  await createPermission(page, group, allPerms, fullPermission)

  // Assign the empty role -> B cannot create a post
  await assignPermission(page, group, noPermission, b.username)
  await gotoGroup(bPage, group)
  await createPostButton.waitFor()
  await expect(createPostButton).toHaveAttribute('aria-disabled', 'true')

  // Assign the full role -> B can create a post
  await assignPermission(page, group, fullPermission, b.username)
  await gotoGroup(bPage, group)
  await createPostButton.waitFor()
  await expect(createPostButton).toHaveAttribute('aria-disabled', 'false')

  await deleteGroup(page, group)
})
