import { expect } from '@playwright/test'

// Open a group chat channel by its title. Both the invite entry and the preview
// entry carry the title; the invite entry is disabled until its invite is
// accepted+refetched. Filtering to :enabled buttons deterministically waits for
// a clickable entry instead of racing against which one renders first.
export const openChannel = (p: any, title: string) =>
  p.locator('button:enabled').filter({ hasText: title }).first().click()

// Send a chat message reliably. The frontend drops a message if the WebSocket
// isn't OPEN yet (Socket.sendMessage returns false silently), which happens
// right after a reload. A successful send appends the message optimistically and
// synchronously, so retry until the sender's own message count grows.
export const sendChatMessage = async (p: any, text = 'Hello!! :D') => {
  const box = p.getByPlaceholder('Write a message...')
  const own = p.locator('#chat-window').getByText(text)
  const before = await own.count()
  await expect(async () => {
    await box.fill(text)
    await box.press('Enter')
    await expect(own).toHaveCount(before + 1, { timeout: 1500 })
  }).toPass({ timeout: 20000 })
}
