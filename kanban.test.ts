import { test, expect } from '@playwright/test'
import { newWindow, randomString, register } from './generic'
import { createGroup, gotoGroup, joinGroup } from './group'

// One user: create, edit and delete a personal kanban entry
test('Kanban-User', async ({ page }) => {
  await register(page)

  await page.goto(`${process.env.LINK}/kanban`)
  await expect(page).toHaveURL(`${process.env.LINK}/kanban`)
  await expect(page.locator('#kanban-board')).toBeVisible()

  // Create an entry in the Done lane
  const doneButton = page.locator('#Done-add')
  await expect(doneButton).toBeVisible()
  await doneButton.click()

  const createModal = page.locator('#create-kanban-entry-modal')
  await expect(createModal).toBeVisible()
  await page.locator('#create-kanban-text').fill('test kanban')
  await page.locator('#create-kanban-textarea').fill('test kanban description')
  await page.locator('button', { hasText: 'Confirm' }).click()
  await expect(createModal).toBeHidden()

  // The new entry shows up in the Done lane
  const kanbanEntry = page.locator('#Done-kanban-lane > ul > div').first()
  await expect(kanbanEntry).toBeVisible()

  // Edit it. Retry the whole edit: the board's 20s auto-refresh can re-init the
  // form mid-edit and discard the typed value, so re-apply until it sticks.
  await kanbanEntry.click()
  const kanbanEntryModal = page.locator('#kanban-entry-modal')
  await expect(kanbanEntryModal).toBeVisible()
  await expect(async () => {
    if (!(await page.locator('#kanban-edit-title').isVisible())) await page.locator('#Edit').click()
    await page.locator('#kanban-edit-title').fill('test kanban edited')
    await page.locator('#kanban-edit-description').fill('test kanban description edited')
    await page.locator('#Update').click()
    await expect(kanbanEntryModal.getByRole('heading', { name: 'test kanban edited' })).toBeVisible({ timeout: 5000 })
  }).toPass()

  // Delete it (Delete only shows while editing)
  await page.locator('#Edit').click()
  await page.locator('#Delete').click()
  await expect(kanbanEntryModal).toBeHidden()

  // Confirm it is gone after a fresh load
  await page.reload()
  await expect(page.locator('#Done-kanban-lane').getByText('test kanban edited', { exact: true })).toBeHidden()
})

// Two users: A creates a group entry, B sees it, A edits it, B sees the edit, A deletes it, B sees it gone
test('Kanban-Group', async ({ page }) => {
  const group = { name: 'Test Kanban Group ' + randomString(), public: true, invite: false }

  // A creates the group and a group kanban entry
  await register(page)
  await createGroup(page, group)
  await page.locator('#group-tasks-sidebar-button').click()
  await expect(page.locator('#kanban-board')).toBeVisible()

  const doneButton = page.locator('#Done-add')
  await expect(doneButton).toBeVisible()
  await doneButton.click()

  const createModal = page.locator('#create-kanban-entry-modal')
  await expect(createModal).toBeVisible()
  await page.locator('#create-kanban-text').fill('group kanban')
  await page.locator('#create-kanban-textarea').fill('group kanban description')
  await page.locator('button', { hasText: 'Confirm' }).click()
  await expect(createModal).toBeHidden()

  // The card title in the Done lane (clicking the card body navigates to the group, so target the title)
  const entryTitle = page.locator('#Done-kanban-lane').getByText('group kanban', { exact: true })
  await expect(entryTitle).toBeVisible()

  // B joins the group and sees the entry
  const bPage = await newWindow()
  await register(bPage)
  await joinGroup(bPage, group)
  await gotoGroup(bPage, group)
  await bPage.locator('#group-tasks-sidebar-button').click()
  await expect(bPage.locator('#kanban-board')).toBeVisible()
  await expect(bPage.locator('#Done-kanban-lane').getByText('group kanban', { exact: true })).toBeVisible()

  // A edits the entry (retry to survive the board's 20s auto-refresh resetting the form)
  await entryTitle.click()
  const kanbanEntryModal = page.locator('#kanban-entry-modal')
  await expect(kanbanEntryModal).toBeVisible()
  await expect(async () => {
    if (!(await page.locator('#kanban-edit-title').isVisible())) await page.locator('#Edit').click()
    await page.locator('#kanban-edit-title').fill('group kanban edited')
    await page.locator('#Update').click()
    await expect(kanbanEntryModal.getByRole('heading', { name: 'group kanban edited' })).toBeVisible({ timeout: 5000 })
  }).toPass()

  // B sees the edit
  await bPage.reload()
  await expect(bPage.locator('#Done-kanban-lane').getByText('group kanban edited', { exact: true })).toBeVisible()

  // A deletes the entry
  await page.locator('#Edit').click()
  await page.locator('#Delete').click()
  await expect(kanbanEntryModal).toBeHidden()

  // B sees it gone
  await bPage.reload()
  await expect(bPage.locator('#Done-kanban-lane').getByText('group kanban edited', { exact: true })).toBeHidden()
})

const createEntry = async (page: any, title: string) => {
  await page.locator('#Done-add').click()
  const createModal = page.locator('#create-kanban-entry-modal')
  await expect(createModal).toBeVisible()
  await page.locator('#create-kanban-text').fill(title)
  await page.locator('#create-kanban-textarea').fill(`${title} description`)
  await page.locator('button', { hasText: 'Confirm' }).click()
  await expect(createModal).toBeHidden()
}

const authorized = async (page: any) => ({
  Authorization: `Token ${await page.evaluate(() => localStorage.getItem('token'))}`,
})

const createGroupApi = async (page: any, name: string) => {
  const created = await page.request.post(`${process.env.LINK}/api/group/create`, {
    headers: await authorized(page),
    multipart: {
      name,
      description: 'Group for kanban tests',
      direct_join: 'true',
      public: 'true',
      blockchain_id: String(Math.floor(Math.random() * 2147483647)),
      hide_poll_users: 'false',
    },
  })
  expect(created.ok()).toBe(true)
  return (await created.json()) as number
}

// Creates a role in the group (as its admin) and assigns it to the user
const assignRole = async (page: any, groupId: number, userId: number, role: Record<string, boolean | string>) => {
  const created = await page.request.post(`${process.env.LINK}/api/group/${groupId}/permission/create`, {
    headers: await authorized(page),
    data: role,
  })
  expect(created.ok()).toBe(true)

  const roles = await page.request.get(`${process.env.LINK}/api/group/${groupId}/permissions`, {
    headers: await authorized(page),
    params: { role_name: role.role_name as string },
  })
  const roleId = (await roles.json()).results[0].id

  const assigned = await page.request.post(`${process.env.LINK}/api/group/${groupId}/user/update`, {
    headers: await authorized(page),
    data: { target_user_id: userId, permission: roleId, is_admin: false },
  })
  expect(assigned.ok(), await assigned.text()).toBe(true)
}

const changeGroup = async (page: any, groupId: number, entryId: number, targetGroupId: number) =>
  page.request.post(`${process.env.LINK}/api/group/${groupId}/kanban/entry/change_group`, {
    headers: await authorized(page),
    data: { entry_id: entryId, target_group_id: targetGroupId },
  })

const groupEntryTitles = async (page: any, groupId: number) => {
  const list = await page.request.get(`${process.env.LINK}/api/user/kanban/entry/list`, {
    headers: await authorized(page),
    params: { origin_type: 'group', origin_id: groupId },
  })
  return (await list.json()).results.map((entry: any) => entry.title)
}

// One user in two groups: moves a group entry from the first group to the second
test('Kanban-ChangeGroup', async ({ page }) => {
  test.slow()

  const groupOne = { name: 'Test Kanban Move From ' + randomString() }
  const groupTwo = { name: 'Test Kanban Move To ' + randomString() }

  await register(page)
  const groupOneId = await createGroupApi(page, groupOne.name)
  const groupTwoId = await createGroupApi(page, groupTwo.name)

  await page.goto(`${process.env.LINK}/groups/${groupOneId}`)
  await page.locator('#group-tasks-sidebar-button').click()
  await expect(page.locator('#kanban-board')).toBeVisible()
  await createEntry(page, 'move me')

  // The board lists entries from all joined groups, each card names its group
  const card = page.locator('#Done-kanban-lane > ul > div', { hasText: 'move me' })
  await expect(card).toContainText(`Group: ${groupOne.name}`)

  // The group the entry is already in is not offered as a target
  await card.getByText('move me', { exact: true }).click()
  const kanbanEntryModal = page.locator('#kanban-entry-modal')
  await expect(kanbanEntryModal).toBeVisible()
  const target = page.locator('#kanban-move-group')
  await expect(target.locator('option', { hasText: groupTwo.name })).toHaveCount(1)
  await expect(target.locator('option', { hasText: groupOne.name })).toHaveCount(0)

  await target.selectOption({ label: groupTwo.name })
  await page.locator('#kanban-move-group-button').click()
  await expect(kanbanEntryModal).toBeHidden()

  // The entry now belongs to the second group, also after a fresh load
  await expect(card).toContainText(`Group: ${groupTwo.name}`)
  await page.reload()
  await expect(card).toContainText(`Group: ${groupTwo.name}`)
  await expect(page.locator('#Done-kanban-lane').getByText('move me', { exact: true })).toHaveCount(1)

  expect(await groupEntryTitles(page, groupOneId)).not.toContain('move me')
  expect(await groupEntryTitles(page, groupTwoId)).toContain('move me')
})

// A owns the source group, B the target group, and C is a member of both without delete rights in the
// source or create rights in the target. Moving an entry must be refused and leave both boards untouched.
test('Kanban-ChangeGroup-NoPermission', async ({ page }) => {
  test.slow()

  const bPage = await newWindow()
  const cPage = await newWindow()

  await register(page)
  await register(bPage)
  await register(cPage)

  const source = await createGroupApi(page, 'Test Kanban Source ' + randomString())
  const target = await createGroupApi(bPage, 'Test Kanban Target ' + randomString())

  const me = await cPage.request.get(`${process.env.LINK}/api/user`, { headers: await authorized(cPage) })
  const cId = (await me.json()).id

  for (const groupId of [source, target]) {
    const joined = await cPage.request.post(`${process.env.LINK}/api/group/${groupId}/join`, {
      headers: await authorized(cPage),
    })
    expect(joined.ok()).toBe(true)
  }

  const created = await page.request.post(`${process.env.LINK}/api/group/${source}/kanban/entry/create`, {
    headers: await authorized(page),
    data: { title: 'stay put', description: 'stay put description', lane: 5, priority: 3 },
  })
  expect(created.ok()).toBe(true)
  const entryId = await created.json()

  await assignRole(page, source, cId, { role_name: 'No delete', delete_kanban_task: false })
  await assignRole(bPage, target, cId, { role_name: 'No create', create_kanban_task: false })

  // Denied on both ends
  const denied = await changeGroup(cPage, source, entryId, target)
  expect(denied.status()).toBe(403)

  // Denied on the source end only
  await assignRole(bPage, target, cId, { role_name: 'Can create', create_kanban_task: true })
  const deniedSource = await changeGroup(cPage, source, entryId, target)
  expect(deniedSource.status()).toBe(403)

  expect(await groupEntryTitles(page, source)).toContain('stay put')
  expect(await groupEntryTitles(bPage, target)).not.toContain('stay put')
})
