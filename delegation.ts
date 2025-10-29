import { expect } from "@playwright/test";

export async function becomeDelegate(page: any, group = { name: 'Test Group Delegation' }) {
    await page.getByRole('button', { name: 'Delegations' }).first().click();

    // await page.locator('#delegate-group-select').selectOption({ label: group.name });
    await page.getByRole('textbox', { name: '0/' }).click();
    await page.getByRole('textbox', { name: '0/' }).fill(group.name);
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: 'Become delegate' })).toBeVisible();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Become delegate' }).click();
    
    // Check if already a delegate
    if (!await page.getByRole('button', { name: 'Stop being delegate' }).isVisible()) {
        // await page.getByRole('button', { name: 'Stop being delegate' }).click();
        await page.waitForTimeout(1000);
        await page.getByRole('button', { name: 'Become delegate' }).nth(1).click();
        await expect(page.getByText('Successfully became delegate')).toBeVisible();
    }

}