import { expect } from '@playwright/test'

export async function becomeDelegate(page: any, group = { name: 'Test Group Delegation' }) {
  await page.getByRole('button', { name: 'Delegation' }).first().click()

  // await page.locator('#delegate-group-select').selectOption({ label: group.name });
  await page.getByRole('textbox', { name: '0/' }).click()
  await page.getByRole('textbox', { name: '0/' }).fill(group.name)
  await expect(page.getByRole('button', { name: 'Become delegate' })).toBeVisible()
  await page.getByRole('button', { name: 'Become delegate' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()

  // // Check if already a delegate
  // if (!(await page.getByText('Stop being delegate').isVisible())) {
  //   // await page.getByRole('button', { name: 'Stop being delegate' }).click();
  //   await page.waitForTimeout(1000)
  //   await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  //   await expect(page.getByText('Stop being delegate')).toBeVisible()
  // }
}

export async function delegateToUser(page: any, group: { name: string }) {
  await page.getByRole('button', { name: 'Delegation', exact: true }).click()
  await page.getByRole('textbox', { name: '0/' }).click()
  await page.getByRole('textbox', { name: '0/' }).fill(group.name)
  await expect(page.getByRole('radio').first()).toBeVisible()
  await page.getByRole('radio').first().check()
  await expect(page.getByRole('radio').first()).toBeChecked()
}

