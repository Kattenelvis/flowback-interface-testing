import test, { expect } from '@playwright/test';
import { login } from './generic';
import { createGroup, gotoGroup } from './group';
import { createThread } from './thread';

const group = { name: 'Test Group Thread', public: false };

test('Thread-Create', async ({ page }) => {
	await login(page);

	await createGroup(page, group);

	await gotoGroup(page, group);

	await createThread(page, group);
});

test('Thread-Comments', async ({ page }) => {
	await login(page);

	await createGroup(page, group);

	await gotoGroup(page, group);

	await createThread(page, group);

	// GOTO THREAD

	await page.getByPlaceholder('Write a comment...').click();
	await page.getByPlaceholder('Write a comment...').fill('Test Comment');
	await page.locator('.submit-button').nth(0).click();
	await page.getByRole('button', { name: 'Reply' }).click();
	await page.getByPlaceholder('Write a comment...').nth(1).click();
	await page.getByPlaceholder('Write a comment...').nth(1).fill('Test Reply with file');
	await page.locator('.submit-button').nth(1).click();

    // TODO Test images in comment
    // TODO Test multiple users
    // TODO Test likes
});

test('Thread-Create-Report-Delete', async ({ page }) => {
	await login(page);

	const group = { name: 'Test Group Thread', public: false };

	await createGroup(page, group);

	await gotoGroup(page, group);

	await createThread(page, group);

	await page.getByPlaceholder('Write a comment...').click();
	await page.getByPlaceholder('Write a comment...').fill('Test Comment');
	await page.locator('.submit-button').nth(0).click();
	await page.getByRole('button', { name: 'Reply' }).click();
	await page.getByPlaceholder('Write a comment...').nth(1).click();
	await page.getByPlaceholder('Write a comment...').nth(1).fill('Test Reply with file');
	await page.locator('.submit-button').nth(1).click();

	//TODO Test images in comment
	await page.getByRole('button', { name: 'Report Thread' }).click();
	await page.getByRole('textbox', { name: 'Title' }).click();
	await page.getByRole('textbox', { name: 'Title' }).fill('Report Test');
	await page.locator('#report-description').click();
	await page.locator('#report-description').fill('This is a test report');
	await page.getByRole('button', { name: 'Report', exact: true }).click();
	await page.getByRole('button', { name: 'delete Thread' }).click();
	await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(1);
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await page.getByRole('button', { name: 'delete Thread' }).click();
	await page.getByRole('button', { name: 'Remove', exact: true }).click();
	await expect(page.getByText('Successfully deleted thread')).toBeVisible();
});
