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
