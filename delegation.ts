import { expect } from '@playwright/test'

export async function becomeDelegate(page: any, group = { name: 'Test Group Delegation' }) {
  await page.getByRole('button', { name: 'Delegation' }).first().click()

  // await page.locator('#delegate-group-select').selectOption({ label: group.name });
  await page.getByRole('textbox', { name: '0/' }).click()
  await page.getByRole('textbox', { name: '0/' }).pressSequentially(group.name)
  await expect(page.getByRole('button', { name: 'Become delegate' })).toBeVisible()

  // Race condition between group search and clicking the become delegate button
  // TODO: Fix race condition for less flakyness.
  await page.waitForTimeout(3000)

  const becomeDelegate = await page.getByRole('button', { name: 'Become delegate' })
  await expect(becomeDelegate).toBeVisible()
  await becomeDelegate.click()

  const confirm = page.getByRole('button', { name: 'Confirm' })
  await expect(confirm).toBeVisible()
  const created = page.waitForResponse(
    (response: any) => response.url().includes('/delegate/pool/create') && response.request().method() === 'POST',
  )
  await confirm.click()
  expect((await created).ok(), 'Becoming delegate failed').toBeTruthy()
  // // Check if already a delegate
  // if (!(await page.getByText('Stop being delegate').isVisible())) {
  //   // await page.getByRole('button', { name: 'Stop being delegate' }).click();
  //   await page.waitForTimeout(1000)
  //   await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  //   await expect(page.getByText('Stop being delegate')).toBeVisible()
  // }
}

export async function delegateToUser(page: any, group: { name: string }, username: string) {
  await page.getByRole('button', { name: 'Delegation', exact: true }).click()
  await page.getByPlaceholder('Search groups').fill(group.name)
  const delegateRadio = page.getByRole('radio', { name: username })
  await expect(delegateRadio).toBeVisible()
  // The radio shows as checked right away, but the delegation only counts once its
  // tags are saved (delegate/update) — leaving the page before that drops them
  const saved = page.waitForResponse(
    (response: any) => response.url().includes('/delegate/update') && response.request().method() === 'POST',
  )
  await delegateRadio.check()
  expect((await saved).ok(), `Delegating to ${username} failed`).toBeTruthy()
  await expect(delegateRadio).toBeChecked()
}

// A delegate can only delegate to themselves. That makes their delegate vote count
// for themselves too, unless they vote personally in the voting phase.
export async function selfDelegate(page: any, group: { name: string }, username: string) {
  await becomeDelegate(page, group)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await delegateToUser(page, group, username)
}

// Opens the first delegate's history for a group and waits until the given poll
// shows up in it. Delegate history is populated asynchronously (celery), so reload
// the delegations page and reopen the history until the entry arrives.
export async function openDelegateHistory(page: any, group: { name: string }, pollTitle: string) {
  await expect(async () => {
    await page.goto(`${process.env.LINK}/delegations`)
    await page.getByRole('textbox', { name: '0/' }).fill(group.name)
    await page.getByRole('link', { name: 'History' }).first().click()
    await expect(page.getByText(/Delegate history for/)).toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('link', { name: pollTitle })).toBeVisible({ timeout: 3000 })
  }).toPass()
  return page.getByRole('listitem').filter({ has: page.getByRole('link', { name: pollTitle }) })
}
