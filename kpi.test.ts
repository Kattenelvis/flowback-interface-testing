import { test, expect } from '@playwright/test';
import { login, newWindow, randomString, register } from './generic';
import { createGroup, gotoGroup, joinGroup } from './group';
import { createPoll, createProposal, fastForward, goToPost } from './poll';
import { createKPI, createGroupKPI, selectProposal, kpiBetFull, kpiEvaluate } from './kpi';

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
})

// Reproduces the backend's track-record weighting (flowback/poll/tests/test_kpi.py,
// bet_outcome_matrix / newer_kpi_betting): predictors are weighted by their
// historical accuracy, not averaged equally. There's no UI that shows the raw
// bet/outcome matrix or the solver's weights directly, so this checks the
// weighting's real, visible effect instead: after one poll where User A bet
// 100% on the value that turned out correct and User B bet 100% on a value
// that turned out wrong, both are tied on bet count and enter the weighting
// as equals. On a second poll where they disagree, User A's historically
// perfect track record should completely dominate the Combined Bet display,
// while User B's should count for nothing.
test('KPI-Track-Record-Weighting', async ({ page }) => {
  test.setTimeout(0)

  const group = { name: 'KPI Weighting ' + randomString(), public: true }
  const kpi = { name: 'Outcome ' + randomString(), values: [10, 20, 30] }

  await register(page) // User A
  await createGroup(page, group)
  await createGroupKPI(page, kpi)

  const bPage = await newWindow()
  await register(bPage) // User B
  await joinGroup(bPage, group)

  await gotoGroup(page, group)

  // ---- Training poll: build a track record for both users ----
  const trainingPoll = { title: 'KPI Training Poll ' + randomString(), phase_time: 1 }
  const trainingProposal = { title: 'KPI Training Proposal ' + randomString() }

  await createPoll(page, trainingPoll)
  await createProposal(page, trainingProposal)

  await fastForward(page, 1) // -> prediction_bet

  await selectProposal(page, trainingProposal.title)
  await kpiBetFull(page, 30) // User A confidently bets on what will be the true outcome

  await goToPost(bPage, trainingPoll)
  await selectProposal(bPage, trainingProposal.title)
  await kpiBetFull(bPage, 10) // User B confidently bets on a value that will turn out wrong

  await fastForward(page, 3) // -> delegate_vote -> vote -> result

  await kpiEvaluate(page, 30) // Confirm the true outcome, closing the training poll's history

  // ---- Test poll: same KPI, but the two users now disagree ----
  const testPoll = { title: 'KPI Weighted Poll ' + randomString(), phase_time: 1 }
  const testProposal = { title: 'KPI Weighted Proposal ' + randomString() }

  await gotoGroup(page, group)
  await createPoll(page, testPoll)
  await createProposal(page, testProposal)

  await fastForward(page, 1) // -> prediction_bet

  await selectProposal(page, testProposal.title)
  await kpiBetFull(page, 20) // User A

  await goToPost(bPage, testPoll)
  await selectProposal(bPage, testProposal.title)
  await kpiBetFull(bPage, 30) // User B

  await fastForward(page, 1) // -> delegate_vote, triggers the weighted recount

  await selectProposal(page, testProposal.title)

  // User A's historically perfect track record should carry full weight...
  await expect(page.locator('#kpi-bet-value-20')).toContainText('100.0%')
  // ...and User B's should carry none.
  await expect(page.locator('#kpi-bet-value-30')).toContainText('0.0%')
})
