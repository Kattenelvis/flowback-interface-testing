import { expect } from '@playwright/test';

export async function createThread(
	page: any,
	group = { name: 'Test Group', public: false },
	thread = { title: 'Test Thread', description: 'Test Description' }
) {
	await page.getByRole('button', { name: 'Create a post' }).click();

	await page.waitForTimeout(500);
	await page.getByRole('button', { name: 'Thread' }).click();
	await page.getByLabel('Title').click();
	await page.getByLabel('Title').fill('Test Thread');
	await page.getByLabel('Description').click();
	await page.getByLabel('Description').fill('Test Description');

	await page.getByRole('button', { name: 'Post' }).click();
	await expect(page.getByRole('heading', { name: 'Thread' })).toBeVisible();
	await expect(
		page.locator('#poll-timeline').filter({ hasText: 'Phase 1. Area voting' })
	).not.toBeVisible();
}
