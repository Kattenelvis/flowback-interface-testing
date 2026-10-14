import test, { expect } from '@playwright/test'
import { newWindow, randomString, register } from './generic'
import { createGroup, deleteGroup, gotoGroup, joinGroup } from './group'
import { createThread } from './thread'
import 'dotenv/config'

// Reports live on the group page next to the other admin actions (/groups/<id>?page=reports),
// not in user settings or Admin Settings. Only admins of the group can see them.
test('Reports-Group-Admin', async ({ page }) => {
    // Two registrations plus a thread and a report; allow for parallel load
    test.slow()

    const group = { name: 'Test Group Reports ' + randomString(), public: true }
    const reportTitle = 'Report Test ' + randomString()

    // A creates a group (becoming its admin) and a thread in it
    await register(page)
    await createGroup(page, group)
    await gotoGroup(page, group)
    const groupId = page.url().match(/\/groups\/(\d+)/)?.[1]
    expect(groupId).toBeTruthy()
    const reportsUrl = `${process.env.LINK}/groups/${groupId}?page=reports`

    await createThread(page, group)

    // A reports the thread
    await page.locator('#poll-header-multiple-choices > button').click()
    await page.getByRole('button', { name: 'Report Thread' }).click()
    await page.getByRole('textbox', { name: 'Title' }).fill(reportTitle)
    await page.locator('#report-description').fill('This is a test report')
    await page.getByRole('button', { name: 'Report', exact: true }).click()
    await expect(page.getByText('Thread reported successfully')).toBeVisible()

    // Linking directly to the reports tab opens it
    const reportsResponse = page.waitForResponse((response: any) =>
        response.url().includes(`server/reports?group_id=${groupId}`),
    )
    await page.goto(reportsUrl)
    const reportsApiResponse = await reportsResponse
    expect(reportsApiResponse.status()).toBe(200)
    await expect(page.locator('#group-header-title')).toHaveText(group.name)

    const reportButton = page.getByRole('button', { name: reportTitle })
    await expect(reportButton).toBeVisible()
    await reportButton.click()

    const modal = page.locator('#report-details-modal')
    await expect(modal.getByText('Report Details')).toBeVisible()
    await expect(modal.getByText(reportTitle)).toBeVisible()
    await expect(modal.getByText('Reported Post')).toBeVisible()
    await expect(modal.getByText('Test Thread')).toBeVisible()
    await expect(modal.getByText('nothing')).toBeVisible()

    await modal.getByRole('button', { name: 'View Post' }).click()
    await expect(page).toHaveURL(new RegExp(`/groups/${groupId}/thread/\\d+`))

    // The admin sidebar button opens the reports and keeps the url in sync
    await gotoGroup(page, group)
    await page.locator('#reports-sidebar-button').click()
    await expect(page).toHaveURL(new RegExp(`/groups/${groupId}\\?page=reports$`))
    await expect(reportButton).toBeVisible()

    // Reports are no longer part of Admin Settings
    await page.getByRole('button', { name: 'Edit Group' }).click()
    await expect(page.getByRole('heading', { name: 'Admin Settings' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reports', exact: true })).toHaveCount(0)

    const bPage = await newWindow()
    await register(bPage)
    // joinGroup doesn't wait for the join to finish; navigating early would leave B a non-member
    const joined = bPage.waitForResponse(
        (response: any) => response.url().includes(`group/${groupId}/join`) && response.ok(),
    )
    await joinGroup(bPage, group)
    await joined
    // B is a member but not an admin: no reports button, and linking to the reports shows nothing
    const bGroupUser = bPage.waitForResponse(
        (response: any) => response.url().includes(`group/${groupId}/users?user_id=`) && response.ok(),
    )
    await bPage.goto(reportsUrl)
    await bGroupUser
    await expect(bPage.locator('#group-header-title')).toHaveText(group.name)
    await expect(bPage.locator('#reports-sidebar-button')).toHaveCount(0)
    await expect(bPage.getByText(reportTitle)).toHaveCount(0)

    // ...and the backend refuses to list the group's reports for B
    const bStatus = await bPage.evaluate(async (url: string) => {
        const res = await fetch(url, { headers: { Authorization: 'Token ' + localStorage.getItem('token') } })
        return res.status
    }, reportsApiResponse.url())
    expect(bStatus).toBe(403)
    await bPage.context().browser()?.close()

    await gotoGroup(page, group)
    await deleteGroup(page, group)
})
