import { test, expect } from '@playwright/test';
import { login, randomString, register } from './generic';
import { createGroup, gotoGroup } from './group';
import { createPoll, createProposal, fastForward } from './poll';
import { createKPI } from './kpi';

test('KPI-Create', async ({ page }) => {
  const group = { name: 'KPI-' + randomString() }
  const kpi = { name: "KPI-Create" }
  await register(page)
  await createGroup(page, group)

  await createKPI(page)

  await gotoGroup(page, group)
  await createPoll(page)
  await createProposal(page)

  await fastForward(page)

  await page.getByRole('button', { name: 'See more' }).click()
  await page.getByText(kpi.name).isVisible()
  await page.getByText("KPI_TEST_DISABLED").isHidden()

  await page.locator('div:nth-child(2) > div:nth-child(3) > .flex-1').click()
  await page.pause()
})
