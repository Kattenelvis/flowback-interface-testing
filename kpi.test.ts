import { test, expect } from '@playwright/test';
import { login, randomString } from './generic';
import { createGroup, gotoGroup } from './group';

test('KPI-Create', async ({ page }) => {
  const group = { name: 'KPI-' + randomString() }
  await login(page)
  await createGroup(page, group)
  // await gotoGroup(group)

  await page.getByRole('button', { name: 'Edit Group' }).click();
  await page.getByRole('button', { name: 'KPIs' }).click();
  await page.getByRole('textbox', { name: 'Name * 0/' }).click();
  await page.getByRole('textbox', { name: 'Name * 0/' }).fill('KPI_TEST');
  await page.getByRole('textbox', { name: 'Description' }).click();
  await page.getByRole('textbox', { name: 'Description' }).fill('TEST');
  await page.getByRole('textbox', { name: 'Values (comma-separated' }).fill('1,2,3,4,5');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('div').filter({ hasText: 'KPI_TEST TEST Values: 1, 2, 3' }).nth(5)).toBeVisible();
  await page.getByRole('textbox', { name: 'Name * 0/' }).click();
  await page.getByRole('textbox', { name: 'Name * 0/' }).fill('KPI_TEST_DISABLED');
  await page.getByRole('textbox', { name: 'Values (comma-separated' }).click();
  await page.getByRole('textbox', { name: 'Values (comma-separated' }).fill('-1,0,hi,text');
  await page.getByRole('button', { name: 'Add' }).click();
  expect(page.getByText('Successfully added KPI')).toBeVisible()
  await page.locator('.switch').click()
})
