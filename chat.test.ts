import { test, expect, chromium } from '@playwright/test'
import { register, newWindow, randomString } from './generic'
import { createGroup, deleteGroup, gotoGroup, joinGroup } from './group'
import 'dotenv/config'

// Open a group chat channel by its title. Both the invite entry and the preview
// entry carry the title; the invite entry is disabled until its invite is
// accepted+refetched. Filtering to :enabled buttons deterministically waits for
// a clickable entry instead of racing against which one renders first.
const openChannel = (p: any, title: string) =>
  p.locator('button:enabled').filter({ hasText: title }).first().click()

// Send a chat message reliably. The frontend drops a message if the WebSocket
// isn't OPEN yet (Socket.sendMessage returns false silently), which happens
// right after a reload. A successful send appends the message optimistically and
// synchronously, so retry until the sender's own message count grows.
const sendChatMessage = async (p: any, text = 'Hello!! :D') => {
  const box = p.getByPlaceholder('Write a message...')
  const own = p.locator('#chat-window').getByText(text)
  const before = await own.count()
  await expect(async () => {
    await box.fill(text)
    await box.press('Enter')
    await expect(own).toHaveCount(before + 1, { timeout: 1500 })
  }).toPass({ timeout: 20000 })
}

test('Group-Chat', async ({ page }) => {
  await register(page)

  const group = { name: 'test-group-chat' + randomString(), public: true }

  await createGroup(page, group)

  const bPage = await newWindow()
  await register(bPage)
  await joinGroup(bPage, group)

  await page.reload()
  await bPage.reload()

  await page.getByRole('button', { name: 'open chat' }).click()
  await page.getByPlaceholder('Search chatters').click()
  await page.getByPlaceholder('Search chatters').fill(group.name)
  await page
    .getByRole('button', { name: `avatar ${group.name}` })
    .first()
    .click()

  await page.getByPlaceholder('Write a message...').click()
  await page.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await page.waitForTimeout(300)
  await page.locator('form > button:nth-child(2)').click()
  await page.getByPlaceholder('Write a message...').click()
  await page.waitForTimeout(300)

  await bPage.getByRole('button', { name: 'open chat' }).click()
  await bPage.getByPlaceholder('Search chatters').click()
  await bPage.getByPlaceholder('Search chatters').fill(group.name)
  await bPage.getByRole('button', { name: group.name }).first().click()
  await page.waitForTimeout(300)
  await bPage.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await bPage.getByPlaceholder('Write a message...').press('Enter')
  await page.waitForTimeout(300)

  await expect(page.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(page.getByText('Hello!! :D').nth(2)).toBeVisible()

  await expect(bPage.getByText('Hello!! :D').nth(1)).toBeVisible()
  await expect(bPage.getByText('Hello!! :D').nth(2)).toBeVisible()

  await gotoGroup(page, group)
  await deleteGroup(page, group)
})

test('Direct-Chat-Via-Group', async ({ page }) => {
  await register(page)

  const group = { name: 'Test Group Chat 2' + randomString(), public: true }

  await createGroup(page, group)

  const browser = await chromium.launch()
  const bContext = await browser.newContext()
  const bPage = await bContext.newPage()

  await register(bPage)
  await joinGroup(bPage, group)
  await gotoGroup(bPage, group)

  await page.getByRole('button', { name: 'Members', exact: true }).click()
  await page.locator('.text-primary').click()

  // Wait for the (empty) channel to finish loading so the optimistic message
  // isn't clobbered when getRecentMessages resolves.
  await expect(
    page.getByText('Chat is currently empty, maybe say hello?'),
  ).toBeVisible()
  await page.getByPlaceholder('Write a message...').click()
  await page.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await page.locator('form > button:nth-child(2)').click()

  await bPage.getByRole('button', { name: 'Members', exact: true }).click()
  await bPage.locator('.text-primary').click()
  // Wait until A's message has loaded before B sends, so B's message survives
  // the getRecentMessages fetch.
  await expect(
    bPage.locator('#chat-window').getByText('Hello!! :D'),
  ).toBeVisible()
  await bPage.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await bPage.getByPlaceholder('Write a message...').press('Enter')

  // The DM is opened from the group member list, so it is not in either user's
  // chat preview sidebar. Both messages should appear in the conversation window.
  await expect(page.locator('#chat-window').getByText('Hello!! :D')).toHaveCount(2)
  await expect(bPage.locator('#chat-window').getByText('Hello!! :D')).toHaveCount(2)

  await page.getByRole('button', { name: 'Close modal' }).click()

  await deleteGroup(page, group)
})

test('Workgroup-Chat', async ({ page }) => {
  await register(page)

  const group = {
    name: 'Test Group Chat Workgroup' + randomString(),
    public: true,
  }

  await createGroup(page, group)

  const bPage = await newWindow()

  await register(bPage)
  await joinGroup(bPage, group)
  await gotoGroup(bPage, group)

  await page.getByRole('button', { name: 'Work Groups' }).click()
  await page.getByRole('button', { name: '+ Add Workgroup' }).click()
  await page.getByLabel('Name').click()

  const workgroup = 'Workgroup for chatting in yay' + randomString()
  await page.getByLabel('Name').fill(workgroup)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByRole('button', { name: 'Join', exact: true }).click()

  await bPage.getByRole('button', { name: 'Work Groups' }).click()
  await bPage.getByRole('button', { name: 'Join', exact: true }).click()

  // The chat preview list is only fetched when the Chat component first mounts.
  // The workgroup channel was created after the page loaded, so reload to make
  // the fresh preview list include it (same pattern as the Group-Chat test).
  await page.reload()
  await bPage.reload()

  await page.getByRole('button', { name: 'open chat' }).click()
  await page.getByPlaceholder('Search chatters').click()
  await page.getByPlaceholder('Search chatters').fill(workgroup)
  // Wait for the channel's message list to finish loading before sending, so the
  // optimistic message isn't clobbered when getRecentMessages resolves. (The
  // workgroup channel is not empty - it has channel-join info messages.)
  const pageMessages = page.waitForResponse((r: any) =>
    r.url().includes('/list?order_by=created_at_desc'),
  )
  await page.getByRole('button', { name: workgroup }).click()
  await pageMessages
  await page.getByPlaceholder('Write a message...').click()
  await page.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await page.locator('form > button:nth-child(2)').click()

  await bPage.getByRole('button', { name: 'open chat' }).click()
  await bPage.getByPlaceholder('Search chatters').click()
  await bPage.getByPlaceholder('Search chatters').fill(workgroup)
  await bPage.getByRole('button', { name: workgroup }).click()
  // Wait until A's message has loaded before B sends, so B's message survives
  // the getRecentMessages fetch.
  await expect(
    bPage.locator('#chat-window').getByText('Hello!! :D'),
  ).toBeVisible()
  await bPage.getByPlaceholder('Write a message...').click()
  await bPage.getByPlaceholder('Write a message...').fill('Hello!! :D')
  await bPage.locator('form > button:nth-child(2)').click()

  // Both participants should see both messages in the conversation window.
  await expect(page.locator('#chat-window').getByText('Hello!! :D')).toHaveCount(2)
  await expect(bPage.locator('#chat-window').getByText('Hello!! :D')).toHaveCount(2)

  await page.getByRole('button', { name: 'Close modal' }).click()
})

// Multi-user "+ New Group" chat: creator A invites B and C, both accept the
// invite, and all three exchange messages in the shared channel.
//
// Backend flow (flowback-backend `user_get_chat_channel`): creating a chat with
// >2 participants makes a `user_group` MessageChannel, auto-joins the creator,
// and sends UserChatInvites to the rest. Accepting an invite
// (UserChatInvite.post_save) flips that user's MessageChannelParticipant to
// active. Frontend `Preview.svelte` only surfaces invites whose title has >2
// comma-separated parts, so the title must be `${uA}, ${uB}, ${uC}`.
test('Group-Chat-Creation', async ({ page }) => {
  const { username: userA } = await register(page)

  const bPage = await newWindow()
  const { username: userB } = await register(bPage)

  const cPage = await newWindow()
  const { username: userC } = await register(cPage)

  // Title needs >2 comma-separated parts or the invite never shows in Preview.
  const title = `${userA}, ${userB}, ${userC}`

  await page.getByRole('button', { name: 'open chat' }).click()

  // Error functionality: confirming with a title but no invited members means
  // the only participant is the creator, so the backend rejects it ("Cannot
  // create a chat with yourself") and the frontend shows the error toast.
  await page.getByRole('button', { name: '+ New Group' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: '+ New Group' }).click()
  await page.getByLabel('Chatgroup Name').fill(title)
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText('Failed to created group chat')).toBeVisible()

  // Invite B and C. There are two "+ Invite user" buttons while creating a group
  // (Preview's own UserSearch + CreateChatGroup's); the second is the one inside
  // the create-group form.
  await page.getByRole('button', { name: 'avatar + Invite user' }).nth(1).click()
  await page.getByRole('textbox', { name: 'User to invite' }).fill(userB)
  await page.getByRole('button', { name: 'Add Me!', exact: true }).click()
  await page.getByRole('textbox', { name: 'User to invite' }).fill(userC)
  await page.getByRole('button', { name: 'Add Me!', exact: true }).click()
  // Close the invite modal (multiple visible "Close modal" buttons exist, so use
  // Escape rather than an index-based locator).
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Confirm', exact: true }).click()

  // On success the new channel opens for the creator. It already contains a
  // "joined the channel" info message, so wait for that to load before sending
  // so the optimistic message isn't clobbered when getRecentMessages resolves.
  await expect(
    page.locator('#chat-window').getByText('joined the channel'),
  ).toBeVisible()
  await sendChatMessage(page)

  // B accepts the invite, opens the channel, waits for A's message to load, then
  // sends. The invite list is only fetched on Preview mount, so reload first.
  await bPage.reload()
  await bPage.getByRole('button', { name: 'open chat' }).click()
  // Wait for the accept POST to finish before reloading, otherwise the reload can
  // abort it and the invite never gets accepted.
  const bAccept = bPage.waitForResponse(
    (r: any) => r.url().includes('/user/chat/invite') && r.request().method() === 'POST',
  )
  await bPage.getByRole('button', { name: 'Accept' }).click()
  await bAccept
  // Accepting doesn't reactively enable the channel button, so reload: the
  // refetched invite (rejected=false) renders an enabled entry to open.
  await bPage.reload()
  await bPage.getByRole('button', { name: 'open chat' }).click()
  await openChannel(bPage, title)
  await expect(
    bPage.locator('#chat-window').getByText('Hello!! :D').first(),
  ).toBeVisible()
  await sendChatMessage(bPage)

  // C does the same.
  await cPage.reload()
  await cPage.getByRole('button', { name: 'open chat' }).click()
  const cAccept = cPage.waitForResponse(
    (r: any) => r.url().includes('/user/chat/invite') && r.request().method() === 'POST',
  )
  await cPage.getByRole('button', { name: 'Accept' }).click()
  await cAccept
  await cPage.reload()
  await cPage.getByRole('button', { name: 'open chat' }).click()
  await openChannel(cPage, title)
  await expect(
    cPage.locator('#chat-window').getByText('Hello!! :D').first(),
  ).toBeVisible()
  await sendChatMessage(cPage)

  // All three messages should be visible to every participant. Reload and
  // reopen the channel so each window re-fetches the persisted messages from the
  // server rather than relying on live WebSocket delivery (which can drop a
  // message to an already-open window).
  for (const p of [page, bPage, cPage]) {
    await p.reload()
    await p.getByRole('button', { name: 'open chat' }).click()
    await openChannel(p, title)
    await expect(p.locator('#chat-window').getByText('Hello!! :D')).toHaveCount(3)
  }
})
