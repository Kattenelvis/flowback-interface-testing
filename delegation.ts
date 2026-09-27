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
  await confirm.click()
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
  await delegateRadio.check()
  await expect(delegateRadio).toBeChecked()
}
