import { test, chromium, expect } from '@playwright/test';
import { login, newWindow, randomString } from "./generic";
import { createGroup, gotoGroup, joinGroup } from './group';
import { createPoll } from './poll';
import { Group, Poll } from './types';

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

})
