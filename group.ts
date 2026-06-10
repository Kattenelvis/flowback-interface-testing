import { expect, type Response } from '@playwright/test'
import { expectOkResponse, idfy, responseMatches } from './generic'

export type group = {
  name: string
  public?: boolean
  invite?: boolean
  id?: number
}

export async function createGroup(page: any, group: group = { name: 'Test Group', public: false, invite: false }) {
  await page.locator('#groups').click()
  await page.getByPlaceholder('Search groups').click()
  await page.getByPlaceholder('Search groups').fill(group.name)

  // await expect(page.getByRole('heading', { name: group.name, exact: true }).first()).toBeVisible();
  const button = await page.getByRole('heading', { name: group.name, exact: true }).first()

  if (await button.isVisible({ timeout: 3000 }).catch(() => false)) {
    await button.click()
  } else {
    await page.getByRole('button', { name: 'Groups' }).click()
    await page.getByRole('button', { name: 'Create Group' }).click()
    await page.getByLabel('Title').click()
    await page.getByLabel('Title').fill(group.name)
    await page.getByLabel('Description').click()
    await page.getByLabel('Description').fill('Test Group Description')
    await page.locator('.image-upload > input').nth(0).setInputFiles('./image.png')
    await page.getByRole('button', { name: 'Confirm' }).click()
    await page.waitForTimeout(500)
    await page.locator('.image-upload > input').nth(1).setInputFiles('./image.png')
    await page.locator('#cropper-confirm').first().click()
    await page
      .locator('fieldset')
      .filter({ hasText: 'Public? Yes No' })
      .getByLabel(group.public ? 'Yes' : 'No')
      .check()
    if (group.public)
      await page
        .locator('fieldset')
        .filter({ hasText: 'Invitation Required? Yes No' })
        .getByLabel(group.invite ? 'Yes' : 'No')
      .check()
    await page.locator('fieldset').filter({ hasText: 'Hide creators? Yes No' }).getByLabel('No').check()
    const groupCreateResponse = page.waitForResponse((response: Response) =>
      responseMatches(response, 'POST', /\/group\/create$/),
    )
    const tagCreateResponse = page.waitForResponse((response: Response) =>
      responseMatches(response, 'POST', /\/group\/\d+\/tag\/create$/),
    )
    await page.getByRole('button', { name: 'Create' }).click()
    const createResponse = await groupCreateResponse
    await expectOkResponse(createResponse, 'Create group')
    await expectOkResponse(await tagCreateResponse, 'Create default group tag')
    await expect(page).toHaveURL(/\/groups\/\d+$/, { timeout: 15000 })
    await expect(page.locator('#group-header-title')).toHaveText(group.name)
    // Capture the real group id so later navigation is by id, not a racy
    // substring search over the (shared) group list.
    const url = new URL(page.url())
    const idFromUrl = Number(url.pathname.match(/\/groups\/(\d+)/)?.[1])
    group.id = Number.isFinite(idFromUrl) ? idFromUrl : group.id
  }
}

export async function gotoGroup(page: any, group: { name: string; id?: number } = { name: 'Test Group' }) {
  // Fast, race-free path: navigate straight to the group by id.
  if (group.id) {
    await page.goto(`${process.env.LINK}/groups/${group.id}`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/groups\/\d+$/, { timeout: 30000 })
    await expect(page.locator('#group-header-title')).toHaveText(group.name, { timeout: 30000 })
    return
  }

  await page.locator('#groups').click()
  await expect(page.getByPlaceholder('Search groups')).toBeVisible({ timeout: 10000 })

  // Search with retry: fill('') can race with fill(group.name) if the empty-search response
  // arrives after the targeted-search response, overwriting UI. Retry resolves this.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByPlaceholder('Search groups').fill('')
    const groupSearchResponse = page.waitForResponse((response: Response) => {
      if (!responseMatches(response, 'GET', /\/group\/list$/)) return false
      return new URL(response.url()).searchParams.get('name__icontains') === group.name
    })
    await page.getByPlaceholder('Search groups').fill(group.name)
    await expectOkResponse(await groupSearchResponse, 'Search groups')
    if (await page.getByRole('heading', { name: group.name, exact: true }).isVisible().catch(() => false)) break
    // Brief wait for any late-arriving response to settle before retrying
    await page.waitForTimeout(1000)
  }

  await expect(page.getByRole('heading', { name: group.name, exact: true })).toBeVisible({ timeout: 10000 })
  await page.getByRole('heading', { name: group.name, exact: true }).click()
  await expect(page).toHaveURL(/\/groups\/\d+$/, { timeout: 15000 })
  await expect(page.locator('#group-header-title')).toHaveText(group.name)
}

export async function gotoFirstGroup(page: any) {
  await page.locator('#groups').click()
  await page.locator('#groups-list > button').nth(1).click()
}

export async function joinGroup(page: any, group = { name: 'Test Group' }) {
  await page.locator('#groups').click()
  await expect(page.getByPlaceholder('Search groups')).toBeVisible({ timeout: 10000 })
  await page.getByPlaceholder('Search groups').fill('')
  // Wait for empty-search response to settle before targeted search
  await Promise.race([
    page.waitForResponse((r: Response) => responseMatches(r, 'GET', /\/group\/list$/)),
    page.waitForTimeout(3000),
  ])
  const groupSearchResponse = page.waitForResponse((response: Response) => {
    if (!responseMatches(response, 'GET', /\/group\/list$/)) return false
    return new URL(response.url()).searchParams.get('name__icontains') === group.name
  })
  await page.getByPlaceholder('Search groups').fill(group.name)
  await expectOkResponse(await groupSearchResponse, 'Search groups')
  const joinButton = page.locator(`#join-${idfy(group.name)}`)
  await expect(joinButton).toBeVisible({ timeout: 10000 })

  if ((await joinButton.innerText()).trim() === 'Join' || (await joinButton.innerText()).trim() === 'Ask to join') {
    const joinResponse = page.waitForResponse((response: Response) =>
      responseMatches(response, 'POST', /\/group\/\d+\/join$/),
    )
    await joinButton.click()
    await expectOkResponse(await joinResponse, 'Join group')
  }
}

export async function deleteGroup(page: any, group = { name: 'Test Group', public: false }) {
  // Deleting Group
  await page.getByRole('button', { name: 'Edit Group' }).click()
  await page.getByRole('button', { name: 'Delete Group' }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Delete Group' }).click()
  await page.getByRole('button', { name: 'Yes', exact: true }).click()
  await expect(page).toHaveURL(`${process.env.LINK}/groups`)
}

export async function createArea(page: any, group = { name: 'Test Group', public: false }, tag = 'Test Tag') {
  await page.getByRole('button', { name: 'Edit Group' }).dispatchEvent('click')
  await expect(page.getByRole('button', { name: 'Areas' })).toBeVisible()
  await page.getByRole('button', { name: 'Areas' }).click()
  await page.getByLabel('Tag').click()
  await page.getByLabel('Tag').fill(tag)
  await page.getByLabel('Description').click()
  await page.getByLabel('Description').fill('Tag description')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.locator('div:nth-child(3) > div').filter({ hasText: tag })).toHaveText(tag)
}
