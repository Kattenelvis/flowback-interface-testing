import { test, expect, chromium } from '@playwright/test'
import { register, newWindow, randomString } from './generic'
import { createGroup, deleteGroup, gotoGroup, joinGroup } from './group'
import 'dotenv/config'

// Reproduction tests for chat bugs reported manually. Each asserts the CORRECT
// behaviour, so a currently-broken feature makes the test FAIL — that is the
// point: they reproduce/document the bug, they do NOT fix it.

const openChatIcon = (p: any) =>
  p.getByRole('button', { name: 'open chat' }).click()

// Send a message reliably (the WS may not be OPEN right after a reload; the
// frontend silently drops the send in that case, so retry until our own message
// renders).
const sendChatMessage = async (p: any, text: string) => {
  const box = p.getByPlaceholder('Write a message...')
  const own = p.locator('#chat-window').getByText(text)
  const before = await own.count()
  await expect(async () => {
    await box.fill(text)
    await box.press('Enter')
    await expect(own).toHaveCount(before + 1, { timeout: 1500 })
  }).toPass({ timeout: 20000 })
}

// Create a "+ New Group" chat inviting the given usernames.
const createGroupChat = async (p: any, title: string, invitees: string[]) => {
  await openChatIcon(p)
  await p.getByRole('button', { name: '+ New Group' }).click()
  await p.getByLabel('Chatgroup Name').fill(title)
  await p.getByRole('button', { name: 'avatar + Invite user' }).nth(1).click()
  for (const name of invitees) {
    await p.getByRole('textbox', { name: 'User to invite' }).fill(name)
    await p.getByRole('button', { name: 'Add Me!', exact: true }).click()
  }
  await p.keyboard.press('Escape')
  await p.getByRole('button', { name: 'Confirm', exact: true }).click()
  // On success the channel opens for the creator with their join info message;
  // waiting for it ensures the channel + invites exist before other users look.
  await expect(
    p.locator('#chat-window').getByText('joined the channel').first(),
  ).toBeVisible()
}

// BUG 2: Creating a "+ New Group" chat with only one other member produces a DM
// instead of a group chat (the backend collapses a 2-participant channel into a
// 'user' DM). A group chat sends the other person an invite; a DM does not, so
// the absence of an "Accept" invite for B reproduces the bug.
test('BUG-Two-Person-Group-Chat-Is-Group-Not-DM', async ({ page }) => {
  const { username: userA } = await register(page)
  const bPage = await newWindow()
  const { username: userB } = await register(bPage)

  await createGroupChat(page, `${userA}, ${userB}`, [userB])

  await bPage.reload()
  await openChatIcon(bPage)
  await expect(bPage.getByRole('button', { name: 'Accept' })).toBeVisible({
    timeout: 8000,
  })
})

// BUG (realtime / "must reload to see who joined"): A is viewing a group's chat
// channel. B then joins the same group. The backend posts a "User B joined" info
// message to the channel, and A — already subscribed and viewing — should see it
// live. Reported: A sees nothing until reloading. Root cause: the WS only
// subscribes to channels owned AT CONNECT TIME (consumer.get_participating_channels)
// and the frontend never sends a 'connect_channel' on join, so live delivery to
// the channel group is unreliable.
test('BUG-Group-Join-Visible-Realtime', async ({ page }) => {
  await register(page)
  const group = { name: 'rt-join' + randomString(), public: true }
  await createGroup(page, group)

  // A reloads (so its socket is subscribed to the freshly-created group channel)
  // and opens the group chat channel.
  await page.reload()
  await openChatIcon(page)
  await page.getByPlaceholder('Search chatters').fill(group.name)
  await page.getByRole('button', { name: `avatar ${group.name}` }).first().click()
  await expect(page.getByPlaceholder('Write a message...')).toBeVisible()

  // B joins the group; this should broadcast a join info message to the channel.
  const bPage = await newWindow()
  const { username: userB } = await register(bPage)
  await joinGroup(bPage, group)

  // A, still viewing and never reloading, should see B's join live.
  await expect(
    page.locator('#chat-window').getByText(`${userB} joined`),
  ).toBeVisible({ timeout: 10000 })

  await gotoGroup(page, group)
  await deleteGroup(page, group)
})

// BUG 4: Accepting a group chat invite doesn't reactively enable/open the
// channel — the channel entry stays disabled until you reload, so the "first
// click" appears to do nothing. After Accept (no reload) the channel entry
// button bearing the chat title should become enabled.
test('BUG-Accept-Enables-Channel-Without-Reload', async ({ page }) => {
  const { username: userA } = await register(page)
  const bPage = await newWindow()
  const { username: userB } = await register(bPage)
  const cPage = await newWindow()
  const { username: userC } = await register(cPage)

  const title = `${userA}, ${userB}, ${userC}`
  await createGroupChat(page, title, [userB, userC])

  // B opens the chat and accepts the invite (no reload afterwards).
  await bPage.reload()
  await openChatIcon(bPage)
  const bAccept = bPage.waitForResponse(
    (r: any) =>
      r.url().includes('/user/chat/invite') && r.request().method() === 'POST',
  )
  await bPage.getByRole('button', { name: 'Accept' }).click()
  await bAccept

  // The channel entry (carries the chat title) should now be clickable.
  await expect(
    bPage.locator('button').filter({ hasText: title }).first(),
  ).toBeEnabled({ timeout: 8000 })
})
