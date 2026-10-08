import { test, expect } from '@playwright/test'
import { idfy, login, logout, newWindow, randomString, register } from './generic'
import { createArea, createGroup, gotoGroup, joinGroup } from './group'
import { createPoll, createProposal, fastForward, vote, waitForPhase } from './poll'
import { createThread } from './thread'
import { createGroupKPI, kpiEvaluate } from './kpi'
import { assignPermission, createPermission } from './permission'
import { becomeDelegate, delegateToUser, openDelegateHistory } from './delegation'
import { sendChatMessage } from './chat'
import 'dotenv/config'

// Requirements from the D2 requirements list (see flowback-user-acceptance/missing.md)
// that the site does not fulfil yet. Every test here is EXPECTED TO FAIL until the
// requirement is implemented: the setup steps should pass, and the final assertion,
// tagged with the requirement ID, is the one that goes red.
//
// Run only these with: npx playwright test -g "MISSING-REQ"

const newGroup = () => ({ name: 'Missing Req ' + randomString(), public: true })

// Registers a fresh user who creates (and therefore admins) a new public group.
// createGroup leaves the page on the new group's flow.
async function setupGroup(page: any) {
  const user = await register(page)
  const group = newGroup()
  await createGroup(page, group)
  return { user, group }
}

async function openAdminSettings(page: any) {
  await page.getByRole('button', { name: 'Edit Group' }).click()
  await expect(page.getByRole('heading', { name: 'Admin Settings' })).toBeVisible()
}

// ----- Group admin settings -----

test('(MISSING-REQ) DEL-R05 PRM-R07 HOM-R07 Role editor has delegate, group mail and pin permissions', async ({ page }) => {
  test.skip()
  await setupGroup(page)
  await openAdminSettings(page)
  await page.getByRole('button', { name: 'Permissions', exact: true }).click()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  // Sanity: the permission list is rendered
  await expect(page.getByRole('group').filter({ hasText: 'Create post' })).toBeVisible()

  const permission = (name: RegExp) => page.getByRole('group').filter({ hasText: name })
  expect.soft(permission(/delegate/i), 'DEL-R05: a permission for who may become delegate').toHaveCount(1)
  expect.soft(permission(/mail/i), 'PRM-R07/EML-R01: a "Group mail" permission').toHaveCount(1)
  expect.soft(permission(/pin/i), 'HOM-R07: a "Pin posts" permission').toHaveCount(1)
})

test('(MISSING-REQ) PHS-R03 PHS-R04 PHS-R07 Admin can set minimum phase times and rules for the next phase', async ({ page }) => {
  test.skip()
  await setupGroup(page)
  await openAdminSettings(page)

  await expect(
    page.getByRole('button', { name: /phase settings|poll settings/i }),
    'PHS-R03/R04/R07: Admin Settings should have phase settings (minimum time, criteria, countdown)',
  ).toBeVisible()
})

// ----- Poll creation -----

test('(MISSING-REQ) PCR-R07 PCR-R08 Calendar view of the poll phases is shown and can be dragged', async ({ page }) => {
  await setupGroup(page)
  await page.getByRole('button', { name: 'Create a post' }).click()
  await page.getByRole('button', { name: 'Display advanced time settings' }).click()
  await page.getByRole('radio', { name: 'Calendar' }).check()
  await expect(page.getByRole('radio', { name: 'Calendar' })).toBeChecked()

  await expect(page.getByRole('grid'), 'PCR-R07: the phase calendar should render').toBeVisible()
  await expect(
    page.locator('.fc-event-draggable').first(),
    'PCR-R08: phase edges should be draggable on the calendar',
  ).toBeVisible()
})

test('(MISSING-REQ) PCR-R04 Users with the fast-forward permission can enable Fast Forward on new polls', async ({ page }) => {
  const { group } = await setupGroup(page)

  const bPage = await newWindow()
  const b = await register(bPage)
  await joinGroup(bPage, group)

  // Role with "Create post" (1) and "Fast Forward Poll" (5)
  const permissionName = 'Fast Forward Role ' + randomString()
  await gotoGroup(page, group)
  await openAdminSettings(page)
  await createPermission(page, group, [1, 5], permissionName)
  await assignPermission(page, group, permissionName, b.username)

  await gotoGroup(bPage, group)
  await bPage.getByRole('button', { name: 'Create a post' }).click()
  await expect(bPage.getByRole('textbox', { name: /^Title/ })).toBeVisible()

  await expect(
    bPage.locator('fieldset').filter({ hasText: 'Fast Forward? Yes No' }),
    'PCR-R04: the Fast Forward toggle should be shown to non-admins with the permission',
  ).toBeVisible()
})

// ----- Poll page -----

test('(MISSING-REQ) PCR-R22 Admin can edit a poll', async ({ page }) => {
  test.skip()
  await setupGroup(page)
  await createPoll(page)

  await page.locator('#poll-header-multiple-choices').click()
  await expect(page.getByRole('button', { name: 'Delete Poll' })).toBeVisible()

  await expect(page.getByRole('button', { name: /^edit( poll)?$/i }), 'PCR-R22: the poll menu should have "Edit Poll"').toBeVisible()
})

test('(MISSING-REQ) HOM-R12 Posts can be edited from the flow', async ({ page }) => {
  test.skip()
  const { group } = await setupGroup(page)
  const poll = { title: 'Flow Post ' + randomString() }
  await createPoll(page, poll)
  await gotoGroup(page, group)
  await expect(page.getByRole('button', { name: poll.title, exact: true })).toBeVisible()

  // The group is new, so this poll is the only post and has the only post menu
  await page.locator('#multiple-choices > button').first().click()
  await expect(page.getByRole('button', { name: 'Delete Post' })).toBeVisible()

  await expect(page.getByRole('button', { name: /^edit( post)?$/i }), 'HOM-R12: the post menu should have "Edit Post"').toBeVisible()
})

test('(MISSING-REQ) THR-R13 Author can edit a thread', async ({ page }) => {
  test.skip()
  const { group } = await setupGroup(page)
  await createThread(page, group)

  await page.locator('#poll-header-multiple-choices > button').click()
  await expect(page.getByRole('button', { name: 'Report Thread' })).toBeVisible()

  await expect(page.getByRole('button', { name: /^edit( thread)?$/i }), 'THR-R13: the thread menu should have "Edit Thread"').toBeVisible()
})

test('(MISSING-REQ) DTP-R04 Date poll page shows the current phase', async ({ page }) => {
  test.skip()
  await setupGroup(page)
  await createPoll(page, { title: 'Date Poll ' + randomString(), date: true })

  await expect(page.getByText(/current:?\s*phase/i).first(), 'DTP-R04: the date poll page should show its phase').toBeVisible()
})

// ----- Delegate profile -----

// ----- Schedule -----

test('(MISSING-REQ) SCH-R07 SCH-R08 SCH-R09 SCH-R11 SCH-R12 Event form has whole day, custom frequency, members, attachments and reminders', async ({ page }) => {
  await register(page)
  await page.goto(`${process.env.LINK}/schedule`)
  await page.getByRole('button', { name: '+', exact: true }).click()
  const form = page.locator('form').filter({ hasText: 'Meeting Link' })
  await expect(form).toBeVisible()

  expect.soft(form.getByText(/whole day|all day/i), 'SCH-R07: a whole-day option').toBeVisible()
  expect.soft(
    form.locator('select[name="Repeat Frequency"] option').filter({ hasText: /custom/i }),
    'SCH-R08: a custom repeat frequency',
  ).toHaveCount(1)
  expect.soft(form.getByText(/members|participants|attendees/i).first(), 'SCH-R09: add/remove members').toBeVisible()
  expect.soft(form.getByText(/add files|attachments/i).first(), 'SCH-R11: attachments').toBeVisible()
  expect.soft(form.getByText(/reminder/i).first(), 'SCH-R12: reminders').toBeVisible()
})

// ----- Kanban -----

test('(MISSING-REQ) KAN-R01 Tasks can be sorted and filtered by priority and due date', async ({ page }) => {
  await register(page)
  await page.goto(`${process.env.LINK}/kanban`)
  await expect(page.locator('#kanban-board')).toBeVisible()

  expect.soft(page.getByText(/^sort/i).filter({ visible: true }).first(), 'KAN-R01: a sort control on the board').toBeVisible()

  await page.getByRole('button', { name: /^Filter/ }).click()
  await expect(page.getByRole('heading', { name: 'Advanced Filter' })).toBeVisible()
  expect.soft(page.getByText(/priority/i).filter({ visible: true }).first(), 'KAN-R01: filter by priority').toBeVisible()
  expect.soft(page.getByText(/due date|end date/i).filter({ visible: true }).first(), 'KAN-R01: filter by due date').toBeVisible()
})

test('(MISSING-REQ) KAN-R09 A task can have several assignees', async ({ page }) => {
  test.skip()
  await register(page)
  await page.goto(`${process.env.LINK}/kanban`)
  await page.locator('#Done-add').click()
  const modal = page.locator('#create-kanban-entry-modal')
  await expect(modal).toBeVisible()

  const assignee = modal.locator('div').filter({ has: page.locator('label', { hasText: 'Assignee' }) }).locator('select').last()
  await expect(assignee).toBeVisible()

  await expect(assignee, 'KAN-R09: the assignee picker should allow several assignees').toHaveJSProperty('multiple', true)
})

test('(MISSING-REQ) KAN-R13 Super-admin can rename and change the number of Kanban lanes', async ({ page }) => {
  test.skip()
  // The default user "a" is a super-admin
  await login(page)
  await page.goto(`${process.env.LINK}/kanban`)
  await expect(page.locator('#Done-kanban-lane')).toBeVisible()

  await expect(
    page.getByRole('button', { name: /lane/i }).first(),
    'KAN-R13: lanes should be editable (rename, add, remove) by a super-admin',
  ).toBeVisible()
})

// ----- Chat -----

// Opens the chat on the channel that was created together with the group
async function openGroupChat(page: any, group: { name: string }) {
  // The new group's channel is only listed after a reload
  await page.reload()
  await page.getByRole('button', { name: 'open chat' }).click()
  await page.getByPlaceholder('Search chatters').fill(group.name)
  await page.getByRole('button', { name: `avatar ${group.name}` }).first().click()
  await expect(page.getByPlaceholder('Write a message...')).toBeVisible()
}

test('(MISSING-REQ) CHT-R09 CHT-R10 Users can edit and delete their own chat messages', async ({ page }) => {
  const { group } = await setupGroup(page)
  await openGroupChat(page, group)
  const text = 'Message ' + randomString()
  await sendChatMessage(page, text)

  const message = page.locator('#chat-window').getByText(text)
  await message.hover()

  expect.soft(page.locator('#chat-window').getByRole('button', { name: /edit/i }), 'CHT-R09: edit message').toBeVisible()
  expect.soft(page.locator('#chat-window').getByRole('button', { name: /delete/i }), 'CHT-R10: delete message').toBeVisible()
})

test('(MISSING-REQ) CHT-R05 Group chats can be deleted', async ({ page }) => {
  const { group } = await setupGroup(page)
  await openGroupChat(page, group)

  await expect(
    page.getByRole('button', { name: /delete (group|chat)/i }).first(),
    'CHT-R05: a group chat should be deletable',
  ).toBeVisible()
})

// ----- reports ----- 

test('(MISSING-REQ) CHT-R11 Users can report another user', async ({ page }) => {
  test.skip()
  test.slow()
  const { group } = await setupGroup(page)
  const bPage = await newWindow()
  const b = await register(bPage)
  await joinGroup(bPage, group)

  await gotoGroup(page, group)
  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.getByRole('button', { name: `avatar ${b.username}` }).click()
  await expect(page).toHaveURL(/\/user\?id=/)
  await expect(page.getByText('Contact Information')).toBeVisible()

  await expect(page.getByRole('button', { name: /report/i }), 'CHT-R11: another user should be reportable').toBeVisible()
})

// ----- Threads -----

test('(MISSING-REQ) THR-R03 THR-R04 Thread attachments are uploaded and shown on the thread page', async ({ page }) => {
  const { group } = await setupGroup(page)
  await createThread(page, group, undefined, ['./image.png'])

  const attachment = page.locator('a[href*="/media/"]', { has: page.getByRole('img', { name: 'image.png' }) })
  await expect(attachment, 'THR-R03/R04: the uploaded attachment should be shown on the thread').toBeVisible()

  // The thread page should also render on a full page load
  await page.reload()
  await expect(attachment).toBeVisible()
})

// ----- Work groups and files -----

test('(MISSING-REQ) WGR-R02 Admin can edit a work group', async ({ page }) => {
  test.skip()
  await setupGroup(page)
  const workGroup = 'Work Group ' + randomString()
  await page.getByRole('button', { name: 'Work Groups', exact: true }).click()
  await page.getByRole('button', { name: '+ Add Workgroup' }).click()
  await page.getByRole('textbox', { name: /^Name/ }).fill(workGroup)
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  const row = page.locator(`[id="${workGroup}"]`)
  await expect(row).toBeVisible()

  await expect(row.getByRole('button', { name: /edit/i }), 'WGR-R02: the work group should be editable').toBeVisible()
})

test('(MISSING-REQ) EML-R04 Admin can email the members of one work group', async ({ page }) => {
  test.skip()
  await setupGroup(page)
  await page.getByRole('button', { name: 'Send Email' }).click()
  await expect(page.getByRole('heading', { name: 'Send Mail' })).toBeVisible()

  await expect(
    page.getByRole('combobox', { name: /work ?group/i }),
    'EML-R04: the mail form should let you pick a work group as recipients',
  ).toBeVisible()
})

test('(MISSING-REQ) FIL-R01 Group page links to the group file system (Nextcloud)', async ({ page }) => {
  test.skip
  await setupGroup(page)
  await expect(page.getByRole('button', { name: 'Members', exact: true })).toBeVisible()

  await expect(
    page.getByRole('navigation').getByRole('button', { name: /documents|files|nextcloud/i }),
    'FIL-R01: the group menu should link to the group files',
  ).toBeVisible()
})

// ----- Account and settings -----

test('(MISSING-REQ) LOG-R01 Users can log in with their email address', async ({ page }) => {
  test.skip()
  const user = await register(page)
  await logout(page)

  await test.step('LOG-R01: log in with the email address', () =>
    login(page, { username: user.email, password: user.password }),
  )
})

test('(MISSING-REQ) PST-R01 Polls in phases the user opted out of are hidden', async ({ page }) => {
  test.skip()
  const { group } = await setupGroup(page)
  const poll = { title: 'Opt Out Poll ' + randomString() }
  await createPoll(page, poll)
  await gotoGroup(page, group)
  await createThread(page, group)

  await page.goto(`${process.env.LINK}/user/settings`)
  await page.getByRole('button', { name: 'Poll Process', exact: true }).click()
  const proposalPhase = page
    .locator('li', { has: page.getByText('Proposal creation', { exact: true }) })
    .locator('> input[type="checkbox"]')
  await proposalPhase.uncheck()
  await expect(proposalPhase).not.toBeChecked()

  // The thread is always shown; once it is there the flow has loaded
  await gotoGroup(page, group)
  await expect(page.getByRole('button', { name: 'Test Thread', exact: true })).toBeVisible()

  await expect(
    page.getByRole('button', { name: poll.title, exact: true }),
    'PST-R01: a poll in the proposal phase should be hidden when the user opted out of that phase',
  ).toHaveCount(0)
})
