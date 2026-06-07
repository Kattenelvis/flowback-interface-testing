import { idfy } from './generic'
import { expect, type Response } from '@playwright/test'
import { expectOkResponse, responseMatches } from './generic'

// Only works inside a poll
export async function fastForward(page: any, times = 1) {
  await expect(page.locator('#poll-header-multiple-choices')).toBeVisible()
  for (let i = 0; i < times; i++) {
    if (i > 0) {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('#poll-header-multiple-choices')).toBeVisible()
    }
    const visible = await page.getByRole('button', { name: 'Fast Forward' }).isVisible().catch(() => false)
    if (!visible) await page.locator('#poll-header-multiple-choices').click()
    const fastForwardResponse = page.waitForResponse((response: Response) =>
      responseMatches(response, 'POST', /\/group\/poll\/\d+\/fast_forward$/),
    )
    await expect(page.getByRole('button', { name: 'Fast Forward' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Fast Forward' }).click()
    await expectOkResponse(await fastForwardResponse, 'Fast forward poll')
  }
}

// Only works inside a group. One could use goToGroup before this
export async function createPoll(page: any, { title = 'Test Poll', date = false, phase_time = 1 } = {}) {
  //Create a Poll
  await expect(page).toHaveURL(/\/groups\/\d+$/, { timeout: 15000 })
  await expect(page.locator('#group-header-title')).toBeVisible({ timeout: 15000 })
  const groupId = page.url().match(/\/groups\/(\d+)(?:[/?#]|$)/)?.[1]
  expect(groupId, 'Could not find group id in current URL before creating poll').toBeTruthy()
  await page.getByRole('button', { name: 'Create a post' }).click()
  await expect(page.getByText('PollThread')).toBeVisible()

  await page.getByLabel('Title').click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Description').fill('Test Description')

  if (date) await page.getByLabel('Date Poll').check()

  await page.getByRole('button', { name: 'Display advanced time settings' }).click()
  await page.locator('fieldset').filter({ hasText: 'Public? Yes No' }).getByLabel('Yes').check()
  await page.locator('fieldset').filter({ hasText: 'Fast Forward? Yes No' }).getByLabel('Yes').check()

  await page.getByRole('spinbutton').fill(phase_time.toString())

  let createdPollResponse: Response | undefined
  for (let attempt = 1; attempt <= 3; attempt++) {
    const pollCreateResponse = page.waitForResponse((response: Response) =>
      responseMatches(response, 'POST', new RegExp(`/group/${groupId}/poll/create$`)),
    )
    await page.getByRole('button', { name: 'Post' }).click()
    createdPollResponse = await pollCreateResponse

    if (createdPollResponse.ok()) break

    const body = await createdPollResponse.text().catch(() => '')
    if (attempt === 3 || !body.includes('Group tag instance with id 1 does not exist')) {
      expect(createdPollResponse.ok(), `Create poll failed: ${createdPollResponse.status()} ${createdPollResponse.url()} ${body}`).toBeTruthy()
    }

    await expect(page.getByText('Could not create Poll')).toBeVisible({ timeout: 10000 })
  }

  expect(createdPollResponse, 'Create poll did not receive a response').toBeTruthy()
  await page.evaluate((apiBase) => sessionStorage.setItem('flowbackApiBase', apiBase), createdPollResponse.url().split('/group/')[0])
  await expectOkResponse(createdPollResponse, 'Create poll')
  await expect(page.getByText('Poll Created')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Could not create Poll')).not.toBeVisible()

  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15000 })
}

export async function goToPost(page: any, { title = 'Test Poll' }) {
  await page.getByRole('button', { name: 'Home' }).click()
  await page.getByPlaceholder('Search polls').click()
  await page.getByPlaceholder('Search polls').fill(title)

  await expect(
    page.getByRole('button', { name: title, exact: true }).first(),
  ).toBeVisible()
  await page.getByRole('button', { name: title, exact: true }).first().click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  // expect(await page.locator('#poll-thumbnail-140').getByRole('link', { name: 'Test Poll' })).toBeVisible();
}

export async function areaVote(page: any, { area = 'Default' } = {}) {
  await page
    .locator(`[id="tag-${idfy(area)}"]`)
    .getByRole('radio')
    .check()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('Successfully voted for area')).toBeVisible()
}

//Only works in proposal phase
export async function createProposal(page: any, { title = 'Test Proposal', description = 'Test Description' } = {}) {
  const pollId = page.url().match(/\/polls\/(\d+)(?:[/?#]|$)/)?.[1]
  expect(pollId, 'Could not find poll id in current URL before creating proposal').toBeTruthy()

  const proposalCreateResult = await page.evaluate(
    async ({ description, pollId, title }: { description: string; pollId: string; title: string }) => {
      const apiBase =
        sessionStorage.getItem('flowbackApiBase') ??
        performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => url.includes(`/group/poll/${pollId}/`))
        ?.split(`/group/poll/${pollId}/`)[0]

      if (!apiBase) {
        return {
          ok: false,
          status: 0,
          text: `Could not infer API base for poll ${pollId}`,
          url: '',
        }
      }

      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)

      const response = await fetch(`${apiBase}/group/poll/${pollId}/proposal/create`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${localStorage.getItem('token')}`,
        },
        body: formData,
      })

      return {
        ok: response.ok,
        status: response.status,
        text: await response.text(),
        url: response.url,
      }
    },
    { description, pollId, title },
  )

  expect(
    proposalCreateResult.ok,
    `Create proposal failed: ${proposalCreateResult.status} ${proposalCreateResult.url} ${proposalCreateResult.text}`,
  ).toBeTruthy()

  const proposalsResponse = page.waitForResponse((response: Response) =>
    responseMatches(response, 'GET', new RegExp(`/group/poll/${pollId}/proposals$`)),
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expectOkResponse(await proposalsResponse, 'Reload proposals after creating proposal')
  await expect(page.locator(`#${idfy(title)}`).first()).toBeVisible({ timeout: 15000 })
}

export async function predictionStatementCreate(
  page: any,
  proposal = { title: 'Proposal Title' },
  prediction = { title: 'Prediction Title' },
) {
  await expect(page.locator('#poll-timeline').filter({ hasText: 'Phase 3. Prediction statements creation' })).toBeVisible()
  await page.waitForTimeout(200)
  const visible = await page.getByText('To make a consequence').isVisible()
  if (visible)
    await page
      .locator(`#${idfy(proposal.title)}-selection`)
      .first()
      .click()

  await expect(page.getByText('To make a consequence, please')).not.toBeVisible()

  await page.getByRole('textbox', { name: 'Title' }).fill(prediction.title)
  await page.getByRole('textbox', { name: 'Description' }).fill('Prediction 1')

  await page.locator('.date-time-field > input').nth(0).fill('2000-01-01 00:00:00')

  await page.locator('#poll-structure').click()
  await page.getByRole('button', { name: 'Submit' }).click()

  await expect(page.getByText('Successfully created').first()).toBeVisible()
  await page
    .locator(`#${idfy(proposal.title)}-selected`)
    .first()
    .click()
}

//Prediction Betting
export async function predictionProbability(
  page: any,
  proposal = { title: 'Proposal Title' },
  prediction = { title: 'Prediction Title', vote: 1 },
) {
  await expect(page.locator('#poll-timeline').filter({ hasText: 'Current: Phase 4. Consequence' })).toBeVisible()
  await page
    .locator(`#${idfy(proposal.title)}`)
    .first()
    .locator('button', { hasText: 'See More' })
    .click()
  await page.locator(`#track-container- > div:nth-child(${2 + prediction.vote})`).click()
  await expect(page.getByText('Probability successfully sent').nth(0)).toBeVisible()
}

// Works for both delegate and normal voting
export async function vote(page: any, proposal = { title: 'Proposal Title', vote: 1 }) {
  expect(proposal.vote >= 0 && proposal.vote <= 5, 'Vote must be between 0 and 5')
  // Delegate Voting Phase
  // Wait for a voting phase (delegate or non-delegate)

  await expect(page.locator('#poll-timeline').filter({
    hasText: /Delegate voting|Voting for non-delegates/
  })).toBeVisible()

  await page.waitForTimeout(400)
  await expect(page.locator(`#track-container-${idfy(proposal.title)}`)).toBeVisible()

  const trackContainer = page.locator(`#track-container-${idfy(proposal.title)}`)
  const box = await trackContainer.boundingBox()
  expect(box, `Track container for "${proposal.title}" has no bounding box`).toBeTruthy()

  // Click at the proportional position for the desired vote (0-5 maps to 0-100% of width)
  const xOffset = (proposal.vote / 5) * box!.width
  const yOffset = box!.height / 2

  const voteResponse = page.waitForResponse(
    (response: Response) =>
      responseMatches(response, 'POST', /\/group\/poll\/\d+\/proposal\/vote\/(update|delegate\/update)$/),
    { timeout: 15000 },
  )
  await trackContainer.click({ position: { x: xOffset, y: yOffset } })
  await expectOkResponse(await voteResponse, `Vote on "${proposal.title}" = ${proposal.vote}`)
}

export async function results(page: any) {
  await expect(page.locator('#poll-timeline').filter({ hasText: 'Results' })).toBeVisible()
  await expect(page.getByText('Results', { exact: true })).toBeVisible()

  //TODO: no need for canvas when there have been 0 votes
  await expect(page.locator('canvas')).toBeVisible()

  await page.locator('canvas').click({
    position: {
      x: 43,
      y: 92,
    },
  })
}
