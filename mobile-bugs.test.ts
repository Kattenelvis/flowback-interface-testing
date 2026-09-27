import { test, expect } from '@playwright/test'
import { register, randomString } from './generic'
import { createGroup } from './group'
import { createPoll, createProposal, fastForward, waitForPhase } from './poll'
import 'dotenv/config'

// Reproduction tests for visual bugs seen at phone size (390x844, the viewport
// of the Playwright MCP server in flowback-frontend/.mcp.json). Each asserts the
// CORRECT layout, so a currently-broken screen makes the test FAIL — that is the
// point: they reproduce/document the bugs, they do NOT fix them.
//
// Setup (register, create group/poll) runs at the default desktop viewport so
// the existing helpers keep working; the page is then shrunk to phone size and
// reloaded before anything is checked.

type Box = { x: number; y: number; width: number; height: number }

const PHONE = { width: 390, height: 844 }

const toPhone = async (page: any) => {
    await page.setViewportSize(PHONE)
    await page.reload()
}

const newGroup = async (page: any) => {
    await register(page)
    const group = { name: 'mobile-bugs ' + randomString(), public: true }
    await createGroup(page, group)
    return { group, groupUrl: page.url().split('?')[0] }
}

// What is painted on top of the element's centre: null if it is the element
// itself, otherwise the '#id' of whatever covers it (the fixed bottom
// navigation bar is '#header').
const coveredBy = (locator: any) =>
    locator.evaluate((el: Element) => {
        const r = el.getBoundingClientRect()
        const x = r.left + r.width / 2
        const y = r.top + r.height / 2
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return 'outside the viewport'
        const top = document.elementFromPoint(x, y)
        if (!top || el.contains(top)) return null
        const tagged = top.closest('[id]')
        return tagged ? `#${tagged.id}` : top.tagName.toLowerCase()
    })

const overlapArea = (a: Box, b: Box) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))

// How many px narrower a <select> is than it needs to be to show its current
// value (text, padding and dropdown arrow). > 0 means the value is cut off.
const selectShortfall = (locator: any) =>
    locator.evaluate((select: HTMLSelectElement) => {
        const probe = select.cloneNode(false) as HTMLSelectElement
        probe.appendChild((select.selectedOptions[0] ?? select.options[0]).cloneNode(true))
        probe.style.cssText = 'position:absolute;visibility:hidden;width:auto;min-width:0;max-width:none'
        select.parentElement!.appendChild(probe)
        const needed = probe.getBoundingClientRect().width
        probe.remove()
        return Math.round(needed - select.getBoundingClientRect().width)
    })

// Number of visual lines an element's text is wrapped onto.
const lineCount = (locator: any) =>
    locator.evaluate((el: Element) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        const lines = [...range.getClientRects()].filter((r) => r.width > 0)
        return new Set(lines.map((r) => Math.round(r.top))).size
    })

// BUG: The mobile group menu toggle (the square floating on the right edge of
// every group page) is a blank white box, and the "Close Menu" button has no X.
// GroupSidebar.svelte passes `faIcon=` to svelte-fa, whose prop is `icon`, so
// neither icon renders. FIXED — kept as a regression test.
test('BUG-Mobile-Group-Menu-Toggle-Has-No-Icon', async ({ page }) => {
    await newGroup(page)
    await toPhone(page)

    const toggle = page.getByRole('button', { name: 'Open Menu' })
    await expect(toggle).toBeVisible()
    await expect.soft(toggle.locator('svg'), 'hamburger icon on the menu toggle').toBeVisible()

    await toggle.click()
    await expect
        .soft(page.getByRole('button', { name: 'Close Menu' }).locator('svg'), 'X icon on Close Menu')
        .toBeVisible()
})

// BUG: The opened mobile group menu is a fixed panel covering the bottom half of
// the screen, but its end sits under the fixed bottom navigation bar. Even when
// scrolled all the way down, "Edit Group" (the last item) stays hidden behind
// the nav bar and cannot be tapped. FIXED (menu is now a bottom sheet above the
// nav bar) — kept as a regression test.
test('BUG-Mobile-Group-Menu-Items-Hidden-Behind-Bottom-Nav', async ({ page }) => {
    await newGroup(page)
    await toPhone(page)

    await page.getByRole('button', { name: 'Open Menu' }).click()
    const editGroup = page.getByRole('button', { name: 'Edit Group' })
    await editGroup.scrollIntoViewIfNeeded()

    expect(await coveredBy(editGroup)).toBeNull()
})

// BUG: With a chat conversation open on a phone, the "Write a message..." box is
// behind the fixed bottom navigation bar, so the user cannot tap it to type.
// The chat panel is `fixed h-[100dvh]` without `top-0`, so it starts ~100px down
// the page and its bottom runs off-screen under the nav bar. FIXED — kept as a
// regression test.
test('BUG-Mobile-Chat-Message-Box-Hidden-Behind-Bottom-Nav', async ({ page }) => {
    const { group } = await newGroup(page)
    await toPhone(page)

    await page.getByRole('button', { name: 'open chat' }).click()
    await page.getByPlaceholder('Search chatters').fill(group.name)
    await page
        .getByRole('button', { name: `avatar ${group.name}` })
        .first()
        .click()

    const messageBox = page.getByPlaceholder('Write a message...')
    await expect(messageBox).toBeVisible()
    expect(await coveredBy(messageBox)).toBeNull()
})

// BUG: In the chat list column the "+ New Group" button is pushed partly out of
// its scroll container, so its left side is cut off ("New" / "roup"). FIXED —
// the button is now "New group"; kept as a regression test.
test('BUG-Mobile-Chat-New-Group-Button-Cut-Off', async ({ page }) => {
    await register(page)
    await toPhone(page)

    await page.getByRole('button', { name: 'open chat' }).click()
    const newGroupButton = page.getByRole('button', { name: 'New group' })
    await expect(newGroupButton).toBeVisible()

    const clippedPx = await newGroupButton.evaluate((el: Element) => {
        let container = el.parentElement!
        while (getComputedStyle(container).overflowX === 'visible') container = container.parentElement!
        const b = el.getBoundingClientRect()
        const c = container.getBoundingClientRect()
        return Math.round(Math.max(0, c.left - b.left) + Math.max(0, b.right - c.right))
    })
    expect(clippedPx).toBe(0)
})

// BUG: In the group header the group's name is drawn on top of the round group
// avatar instead of next to/below it.
test('BUG-Mobile-Group-Header-Avatar-Overlaps-Name', async ({ page }) => {
    await newGroup(page)
    await toPhone(page)

    const title = page.locator('#group-header-title')
    const avatar = page.getByRole('img', { name: 'profile', exact: true })
    await expect(title).toBeVisible()
    await expect(avatar).toBeVisible()

    expect(overlapArea((await avatar.boundingBox())!, (await title.boundingBox())!)).toBe(0)
})

// BUG: On a finished poll's card in the group feed, the word "consequences" in
// "View results & evaluate consequences" spills out past the button's border
// (the button is only 47% of an already narrow card).
test('BUG-Mobile-Poll-Card-Results-Button-Text-Overflows', async ({ page }) => {
    const { groupUrl } = await newGroup(page)
    await createPoll(page, { title: 'Mobile results ' + randomString() })
    await fastForward(page, 5)
    await waitForPhase(page, /Results and evaluation/)

    await page.goto(groupUrl)
    await toPhone(page)

    const button = page.getByRole('button', { name: 'View results & evaluate consequences' })
    await expect(button).toBeVisible()
    const overflowPx = await button.evaluate((el: HTMLElement) => el.scrollWidth - el.clientWidth)
    expect(overflowPx).toBeLessThanOrEqual(0)
})

// BUG: Once a poll has proposals (Predictions / Delegate voting phases) a
// "Filter by Proposal" button is added next to the comment sorting, squeezing the
// Sort dropdown so narrow that "Hot" shows as just "H".
// FIXED — kept as a regression test.
test('BUG-Mobile-Comment-Sort-Dropdown-Cut-Off', async ({ page }) => {
    await newGroup(page)
    await createPoll(page, { title: 'Mobile comments ' + randomString() })
    await createProposal(page, { title: 'Mobile proposal' })
    await fastForward(page, 1)
    await waitForPhase(page, /Predictions/)
    await toPhone(page)

    await expect(page.getByRole('button', { name: 'Filter by Proposal' })).toBeVisible()
    const sort = page.locator('select', { has: page.locator('option', { hasText: 'Hot' }) })
    expect(await selectShortfall(sort)).toBeLessThanOrEqual(0)
})

// BUG: On the group Members page the Sort / Role / Role filter dropdowns are
// collapsed to ~8px slivers, so their values cannot be read. The group page's
// <main> is a fixed w-[70vw], leaving the filter row no room on a phone.
// FIXED — kept as a regression test.
test('BUG-Mobile-Member-Filter-Dropdowns-Collapsed', async ({ page }) => {
    const { groupUrl } = await newGroup(page)
    await page.goto(`${groupUrl}?page=members`)
    await toPhone(page)

    await expect(page.getByPlaceholder('Search members')).toBeVisible()
    const selects = await page.locator('main select').all()
    expect(selects.length).toBeGreaterThan(0)
    for (const [i, select] of selects.entries())
        expect.soft(await selectShortfall(select), `filter dropdown #${i + 1}`).toBeLessThanOrEqual(0)
})

// BUG: On the user profile the round avatar is drawn over the grey back button
// in the top-left corner. On mobile the profile no longer renders its own back
// button (the top bar has one), so check the avatar covers none of the buttons
// on the banner.
test('BUG-Mobile-Profile-Avatar-Overlaps-Back-Button', async ({ page }) => {
    await register(page)
    await page.goto(`${process.env.LINK}/user`)
    await toPhone(page)

    const avatar = page.locator('#avatar')
    const bannerButtons = page
        .locator('div.relative', { has: page.getByRole('img', { name: 'banner' }) })
        .getByRole('button')
    await expect(avatar).toBeVisible()
    await expect(page.locator('#edit-profile-button')).toBeVisible()

    const avatarBox = (await avatar.boundingBox())!
    for (const button of await bannerButtons.all())
        expect(overlapArea(avatarBox, (await button.boundingBox())!)).toBe(0)
})

// BUG: The profile's Contact Information column keeps its desktop width of 30%,
// ~95px on a phone, so every line wraps word by word
// ("Phone / number: / None / provided").
test('BUG-Mobile-Profile-Contact-Info-Squeezed', async ({ page }) => {
    await register(page)
    await page.goto(`${process.env.LINK}/user`)
    await toPhone(page)

    const phone = page.locator('#profile-contact-phone').getByText('None provided')
    await expect(phone).toBeVisible()
    expect(await lineCount(phone)).toBe(1)
})

// BUG: The profile edit form kept its desktop layout on a phone: the fields were
// squeezed into a ~114px column beside the avatar and the phone input widened the
// page to 447px. Runs the whole edit flow at phone size.
test('BUG-Mobile-Profile-Edit-Form-Squeezed', async ({ page }) => {
    const newName = randomString() + randomString()
    await register(page)
    await page.goto(`${process.env.LINK}/user`)
    await toPhone(page)

    await page.locator('#edit-profile-button').click()
    const name = page.getByLabel('Name')
    await expect(name).toBeVisible()

    const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(horizontalOverflow).toBeLessThanOrEqual(0)
    expect((await name.boundingBox())!.width).toBeGreaterThan(PHONE.width / 2)

    await name.fill(newName)
    await page.getByLabel('Website').fill('flowback.org')
    await page.getByLabel('Phone number').fill('701234567')
    await page.getByLabel('Mail').fill('mobile@flowback.test')
    await page.getByLabel('Bio').fill('Edited on a phone')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Profile successfully updated').first()).toBeVisible()

    // Saved values show up in the profile, also after a reload
    for (const reload of [false, true]) {
        if (reload) await page.reload()
        await expect(page.getByText(newName).last()).toBeVisible()
        await expect(page.getByText('Edited on a phone')).toBeVisible()
        await expect(page.locator('#profile-contact-website a')).toHaveAttribute('href', 'https://flowback.org')
        await expect(page.locator('#profile-contact-phone a')).toContainText('701234567')
        await expect(page.locator('#profile-contact-email a')).toHaveText('mobile@flowback.test')
    }
})
