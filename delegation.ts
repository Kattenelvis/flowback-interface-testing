import { expect, type Response } from '@playwright/test'
import { expectOkResponse, responseMatches } from './generic'

async function selectDelegationGroup(page: any, group: { name: string }) {
  const groupSearchResponse = page.waitForResponse((response: Response) => {
    if (!responseMatches(response, 'GET', /\/group\/list$/)) return false
    return new URL(response.url()).searchParams.get('name__icontains') === group.name
  })
  await page.getByPlaceholder('Search groups').fill(group.name)
  const response = await groupSearchResponse
  const body = await response.json()
  await expectOkResponse(response, 'Search delegation groups')
  const selectedGroup = body?.results?.find((result: any) => result.name === group.name)

  expect(selectedGroup, `Delegation group "${group.name}" was not returned by search`).toBeTruthy()

  return {
    apiBase: response.url().split('/group/list')[0],
    groupId: selectedGroup.id,
  }
}

export async function becomeDelegate(page: any, group = { name: 'Test Group Delegation' }) {
  const groupId = page.url().match(/\/groups\/(\d+)(?:[/?#]|$)/)?.[1]

  if (groupId) {
    await page.goto(`${process.env.LINK}/delegations?groupId=${groupId}`)
    await expect(page.getByRole('heading', { name: 'Manage Delegations' })).toBeVisible()
  } else {
    await page.getByRole('button', { name: 'Delegation', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Manage Delegations' })).toBeVisible()
  }

  const selectedGroup = await selectDelegationGroup(page, group)
  await expect(page.getByText("There are currently no delegates for this group")).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: 'Become delegate' })).toBeVisible({ timeout: 10000 })

  const delegatePoolResult = await page.evaluate(async ({ apiBase, groupId }: { apiBase: string; groupId: number }) => {
    const token = localStorage.getItem('token')
    const response = await fetch(`${apiBase}/group/${groupId}/delegate/pool/create`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
      url: response.url,
    }
  }, selectedGroup)

  expect(
    delegatePoolResult.ok,
    `Become delegate failed: ${delegatePoolResult.status} ${delegatePoolResult.url} ${delegatePoolResult.text}`,
  ).toBeTruthy()

  await page.goto(`${process.env.LINK}/delegations?groupId=${selectedGroup.groupId}`)
  await expect(page.getByRole('heading', { name: 'Manage Delegations' })).toBeVisible()
  await selectDelegationGroup(page, group)
  await expect(page.getByText('Delegates')).toBeVisible({ timeout: 10000 })

  // // Check if already a delegate
  // if (!(await page.getByText('Stop being delegate').isVisible())) {
  //   // await page.getByRole('button', { name: 'Stop being delegate' }).click();
  //   await page.waitForTimeout(1000)
  //   await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  //   await expect(page.getByText('Stop being delegate')).toBeVisible()
  // }
}

export async function delegateToUser(page: any, group: { name: string }) {
  const groupId = page.url().match(/\/groups\/(\d+)(?:[/?#]|$)/)?.[1]

  if (groupId) {
    await page.goto(`${process.env.LINK}/delegations?groupId=${groupId}`)
    await expect(page.getByRole('heading', { name: 'Manage Delegations' })).toBeVisible()
  } else {
    await page.getByRole('button', { name: 'Delegation', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Manage Delegations' })).toBeVisible()
  }

  const selectedGroup = await selectDelegationGroup(page, group)
  const delegationResult = await page.evaluate(async ({ apiBase, groupId }: { apiBase: string; groupId: number }) => {
    const token = localStorage.getItem('token')
    const jsonHeaders = {
      Accept: 'application/json',
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    }
    const authHeaders = {
      Accept: 'application/json',
      Authorization: `Token ${token}`,
    }

    const poolsResponse = await fetch(`${apiBase}/group/${groupId}/delegate/pools?limit=1000`, { headers: authHeaders })
    const pools = await poolsResponse.json().catch(() => ({}))
    const pool = pools?.results?.[0]

    const tagsResponse = await fetch(`${apiBase}/group/${groupId}/tags?limit=1000`, { headers: authHeaders })
    const tags = await tagsResponse.json().catch(() => ({}))
    const tag = tags?.results?.[0]

    if (!poolsResponse.ok || !pool || !tagsResponse.ok || !tag) {
      return {
        ok: false,
        status: poolsResponse.ok ? tagsResponse.status : poolsResponse.status,
        text: JSON.stringify({ pools, tags }),
        url: poolsResponse.ok ? tagsResponse.url : poolsResponse.url,
      }
    }

    const createResponse = await fetch(`${apiBase}/group/${groupId}/delegate/create`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ delegate_pool_id: pool.id }),
    })
    const createText = await createResponse.text()
    if (!createResponse.ok) {
      return {
        ok: false,
        status: createResponse.status,
        text: createText,
        url: createResponse.url,
      }
    }

    const updateResponse = await fetch(`${apiBase}/group/${groupId}/delegate/update`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ delegate_pool_id: pool.id, tags: [tag.id] }),
    })
    const updateText = await updateResponse.text()

    return {
      ok: updateResponse.ok,
      status: updateResponse.status,
      text: updateText,
      url: updateResponse.url,
    }
  }, selectedGroup)

  expect(
    delegationResult.ok,
    `Delegate to user failed: ${delegationResult.status} ${delegationResult.url} ${delegationResult.text}`,
  ).toBeTruthy()

  await page.goto(`${process.env.LINK}/delegations?groupId=${selectedGroup.groupId}`)
  await expect(page.getByRole('heading', { name: 'Manage Delegations' })).toBeVisible()
  await selectDelegationGroup(page, group)
  await expect(page.getByText('Delegates')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('radio').first()).toBeVisible({ timeout: 10000 })
}
