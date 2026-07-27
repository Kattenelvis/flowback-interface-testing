import { expect } from "playwright/test";

export async function createKPI(page: any, name = "KPI_TEST") {
  await page.getByRole('button', { name: 'Edit Group' }).click();
  await page.getByRole('button', { name: 'KPIs' }).click();
  await page.getByRole('textbox', { name: 'Name' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('textbox', { name: 'Description' }).click();
  await page.getByRole('textbox', { name: 'Description' }).fill('TEST');
  await page.getByRole('textbox', { name: 'Values (comma-separated' }).fill('1,2,3,4,5');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('div').filter({ hasText: 'KPI_TEST TEST Values: 1, 2, 3' }).nth(5)).toBeVisible();
  await page.getByRole('textbox', { name: 'Name' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('KPI_TEST_DISABLED');
  await page.getByRole('textbox', { name: 'Values (comma-separated' }).click();
  await page.getByRole('textbox', { name: 'Values (comma-separated' }).fill('-1,0,hi,text');
  await page.getByRole('button', { name: 'Add' }).click();
  expect(page.getByText('Successfully added KPI')).toBeVisible()
  await page.locator('.switch').nth(1)
}
