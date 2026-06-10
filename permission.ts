import { expect, type Response } from '@playwright/test'
import { gotoGroup } from './group'
import { expectOkResponse, idfy, responseMatches } from './generic'

export async function createPermission(
    page: any,
    group = { name: 'Test Group', public: false },
    permissions = [0],
    permission_name = 'Test Permission',
) {
    try {
        await expect(page.getByRole('heading', { name: 'Admin Settings' })).toBeVisible()
    } catch {
        await gotoGroup(page, group)
        await page.getByRole('button', { name: 'Edit Group' }).click()
    }
    // Create, deactive and delete permission
    await page.getByRole('button', { name: 'Permissions' }).click()
    await page.getByRole('button', { name: 'Create' }).click()
    await page.getByLabel('Role name * 0/').click()
    await page.getByLabel('Role name * 0/').fill(permission_name)
    for (const index of permissions) {
        if (page.locator('.slider').nth(index)) await page.locator('.slider').nth(index).click()
    }
    await page.getByRole('button', { name: 'Create Role' }).click()
}

export async function assignPermission(
    page: any,
    group = { name: 'Test Group', public: false },
    permission_name = 'Test Permission',
    user_name = '',
) {
    // Always (re)open the Assign panel from a fresh group load. The Assign
    // component fetches its member list once on mount, so if it was opened
    // earlier in the edit session (before the target user joined) the list is
    // stale. A fresh navigation guarantees the just-joined user is present.
    await gotoGroup(page, group)
    await page.getByRole('button', { name: 'Edit Group' }).dispatchEvent('click')
    await expect(page.getByRole('heading', { name: 'Admin Settings' })).toBeVisible()

    await page.getByRole('button', { name: 'Permissions' }).click()
    await page.getByRole('button', { name: 'Assign' }).click()

    const addRoleButton = page.locator(`#plus-${idfy(user_name)}`)
    await expect(addRoleButton).toBeVisible({ timeout: 15000 })
    await addRoleButton.click()

    const updatePermissionResponse = page.waitForResponse((response: Response) =>
        responseMatches(response, 'POST', /\/group\/\d+\/user\/update$/),
    )
    await page
        .getByRole('listitem')
        .locator(`#permission-${idfy(permission_name)}-${idfy(user_name)}`)
        .click()
    await expectOkResponse(await updatePermissionResponse, 'Assign group permission')

    await expect(page.getByText('Successfully updated permission')).toBeVisible()
}
