import { test, chromium, expect } from '@playwright/test';
import { login, newWindow, randomString } from "./generic";
import { createGroup, gotoGroup, joinGroup } from './group';
import { createPoll, fastForward, results } from './poll';
import { Group, Poll } from './types';
import { env } from 'process';

test('Group-Notification', async ({ page }) => {

    const group: Group = { name: "GroupTesting" + randomString(), public: true }
    await login(page);
    await createGroup(page, group);

    const bPage = await newWindow();
    await login(bPage, { email: process.env.SECONDUSER_MAIL, password: process.env.SECONDUSER_PASS });

    await joinGroup(bPage, group);
    await gotoGroup(bPage, group);
    await bPage.locator('#group-header').getByRole('button').filter({ hasText: /^$/ }).click();
    await bPage.getByRole('button', { name: 'Group', exact: true }).click();
    await bPage.getByRole('button', { name: 'Group User', exact: true }).click();
    await bPage.getByRole('button', { name: 'Kanban', exact: true }).click();
    await bPage.getByRole('button', { name: 'Polls', exact: true }).click();
    await bPage.getByRole('button', { name: 'Events', exact: true }).click();
    await bPage.getByRole('button', { name: 'Threads', exact: true }).click();

    const poll: Poll = { title: "NotificationPoll" + randomString() }
    await createPoll(page, poll);

    await bPage.reload();

    // TOOD: Once notification system is done, set an expect here to get the right message and that the notification link leads to the right poll

    await page.locator('#notifications-list').click();
    await expect(page.getByRole('button', { name: 'A new poll has been posted' }).nth(1)).toBeVisible();

    await bPage.locator('#notifications-list').click();
    await expect(bPage.getByRole('button', { name: 'A new poll has been posted' }).nth(1)).toBeVisible();
})


test('Poll-Start-To-Finish', async ({ page }) => {
    await login(page);

    const bPage = await newWindow()
    await login(bPage, { email: env.SECONDUSER_MAIL, password: env.SECONDUSER_PASS })

    const group = { name: 'Test Poll start to finish notifications' + randomString(), public: true };
    await createGroup(page, group);

    await gotoGroup(page, group);
    await joinGroup(bPage, group);
    await gotoGroup(bPage, group)

    await bPage.locator('#group-header').getByRole('button').filter({ hasText: /^$/ }).click();
    await bPage.getByRole('button', { name: 'Subscribe to All', exact: true }).click();

    const poll = { title: 'title' + randomString(), phase_time: 1 }
    await createPoll(page, poll);

    await bPage.reload()
    await bPage.locator('#notifications-list').click();
    await bPage.getByRole('button', { name: 'a new poll has been posted' }).nth(0).click();
    await expect(bPage.getByText(poll.title)).toBeVisible()

    await bPage.getByRole('button').filter({ hasText: /^$/ }).nth(4).click();
    await bPage.getByRole('button', { name: 'Subscribe to All' }).click();

    await comment(page, "Notify about me please");

    await bPage.reload()
    await bPage.locator('#notifications-list').click();
    await bPage.getByRole('button', { name: 'a new comment has been posted' }).nth(0).click();
    await expect(bPage.getByText(poll.title)).toBeVisible()

    await fastForward(page, 6);

    await expect(page.getByText('Results There is no winning')).toBeVisible();

    //TODO second comment and poll ff notifications, maybe also evaluation.

    await comment(page, "Notify about me please")
});

const comment = async (page, message: string) => {
    await page.getByPlaceholder('Write a comment...').click();
    await page.getByPlaceholder('Write a comment...').fill(message);
    await page.locator('.text-center.dark\\:saturate-\\[60\\%\\].transition-colors.duration-50.submit-button').click();


} 
