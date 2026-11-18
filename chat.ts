import { expect } from '@playwright/test'

// Open a chat by its title, waiting until its entry in the chat list is clickable.
export const openChannel = (p: any, title: string) =>
  p.locator('button:enabled').filter({ hasText: title }).first().click()

// Send a chat message and wait until the server has confirmed it. Right after a
// reload the websocket may still be connecting, in which case the message is
// marked "Not sent", so retry until it goes through.
export const sendChatMessage = async (p: any, text = 'Hello!! :D') => {
  const box = p.getByPlaceholder('Write a message...')
  const own = p.locator('#chat-window').getByText(text)
  const before = await own.count()
  const notSent = p.locator('#chat-window').getByRole('button', { name: 'Discard' })
  await expect(async () => {
    if (await notSent.count()) await notSent.first().click()
    await box.fill(text)
    await box.press('Enter')
    await expect(own).toHaveCount(before + 1, { timeout: 1500 })
    await expect(p.locator('#chat-window').getByText('Sending...')).toHaveCount(0, { timeout: 5000 })
    await expect(notSent).toHaveCount(0)
  }).toPass({ timeout: 20000 })
}
