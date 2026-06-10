import test, { expect } from './fixtures'
import { createGroup, deleteGroup, gotoGroup, joinGroup } from './group'
import { login, newWindow, randomString, loginAsNewUser, createUser } from './generic'
import { assignPermission, createPermission } from './permission'
import 'dotenv/config'

test('Create-Permission-Full', async ({ page, user }) => {
    await login(page, user)

    const rand = Math.random().toString(36).slice(2, 10)
    const group = { name: 'Test Group Permissions ' + rand, public: true }
    await createGroup(page, group)

    await expect(page.locator('#group-header-title')).toHaveText(group.name)
    await page.getByRole('button', { name: 'Edit Group' }).dispatchEvent('click')

    const permission_name = 'No Permissions'

    let perms = []
    for (let i = 0; i < 17; i++) {
        perms.push(i)
    }

    await createPermission(page, group, perms, permission_name)

    const bPage = await newWindow()

    const userB = await loginAsNewUser(bPage)
    await joinGroup(bPage, group)
    await page.waitForTimeout(400)

    await assignPermission(page, group, permission_name, userB.username)

    await page.waitForTimeout(300)

    await gotoGroup(bPage, group)
    await bPage.locator('#create-a-post-sidebar-button').waitFor()
    expect(await bPage.locator('#create-a-post-sidebar-button').isDisabled()).not

    // await expect(bPage.locator('#create-a-post-sidebar-button').isDisabled())

    await deleteGroup(page, group)
})

test('Create-Permission-None', async ({ page, user }) => {
    await login(page, user)

    const group = { name: 'Test Group Permissions ' + randomString(), public: true }
    await createGroup(page, group)

    await expect(page.locator('#group-header-title')).toHaveText(group.name)

    const bPage = await newWindow()

    const userB = await loginAsNewUser(bPage)
    await joinGroup(bPage, group)

    await page.getByRole('button', { name: 'Edit Group' }).dispatchEvent('click')

    const permission_name = 'No Permissions'
    await createPermission(page, group, [], permission_name)

    await page.waitForTimeout(1000)
    await assignPermission(page, group, permission_name, userB.username)

    await page.waitForTimeout(500)
    await gotoGroup(bPage, group)

    await bPage.locator('#create-a-post-sidebar-button').waitFor()
    await expect(bPage.locator('#create-a-post-sidebar-button').isDisabled()).toBeTruthy()

    await deleteGroup(page, group)
})

