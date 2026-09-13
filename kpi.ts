import { expect } from "playwright/test";
import { idfy } from './generic'

// Creates a single, clean, active group KPI. Unlike createKPI below, this
// doesn't also create a second ("disabled") KPI, so tests that need precise
// control over which KPIs exist and their values can rely on this instead.
export async function createGroupKPI(page: any, { name, values }: { name: string; values: (string | number)[] }) {
  await page.getByRole('button', { name: 'Edit Group' }).click();
  await page.getByRole('button', { name: 'KPIs' }).click();
  await page.getByRole('textbox', { name: 'Name' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('textbox', { name: 'Values (comma-separated' }).click();
  await page.getByRole('textbox', { name: 'Values (comma-separated' }).fill(values.join(','));
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Successfully added KPI')).toBeVisible();
}

// Only works inside a poll, in the prediction_bet phase, after the proposal has
// already been selected (e.g. via selectProposal below).
export async function selectProposal(page: any, title: string) {
  await page.locator(`#${idfy(title)}`).getByRole('button', { name: 'See more' }).click()
}

// Bets ~100% of a predictor's weight on a single KPI value. Clicking near the
// far right edge of the probability bar is the only reliable way to hit 100%,
// since the UI rounds the click position to the nearest 5%.
export async function kpiBetFull(page: any, value: string | number) {
  const bar = page.locator(`[aria-label="Set KPI probability for ${value}"] button`)
  await expect(bar).toBeVisible()
  const box = await bar.boundingBox()
  await bar.click({ position: { x: box.width - 2, y: box.height / 2 } })
}

// Casts the community's vote on which KPI value actually came true. Only
// works in the poll's result phase.
export async function kpiEvaluate(page: any, value: string | number) {
  await page.getByRole('button', { name: String(value), exact: true }).click()
}

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
