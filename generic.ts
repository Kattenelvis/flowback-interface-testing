import { chromium, expect } from '@playwright/test';
import 'dotenv/config'

export const idfy = (text: string) => {
	return text.replace(' ', '-').replace(' ', '-').toLowerCase()
}

export async function newWindow() {
    const browser = await chromium.launch();
    const Context = await browser.newContext();
    const Page = await Context.newPage();
    return Page
}

export async function login(page: any, {
    email = process.env.MAINUSER_MAIL ?? 'a@a.se',
    password = process.env.MAINUSER_PASS ?? 'a',
} = {}) {
    await page.goto(`${process.env.LINK}/login`);
    await expect(page.locator('#login-page')).toBeVisible();
    await page.waitForTimeout(700);

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${process.env.LINK}/home`);

    if (await page.getByRole('button', { name: 'Ok' }).isVisible()) {
        await page.getByRole('button', { name: 'Ok' }).click();
    }
}

export async function loginEnter(page: any, {
    email = process.env.MAINUSER_MAIL ?? 'a@a.se',
    password = process.env.MAINUSER_PASS ?? 'a',
} = {}) {
    await page.goto(`${process.env.LINK}/login`);
    await expect(page.locator('#login-page')).toBeVisible();
    await page.waitForTimeout(700);

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.getByLabel('Password').press('Enter');

    await expect(page).toHaveURL(`${process.env.LINK}/home`);
}

// Tests registring a user
// Only works if PUBLIC_EMAIL_REGISTRATION=FALSE in .env
// Email functionality appears to only be manually testable afaik 
export async function register(page: any) {
    const randomUSername = randomString();
    const randomEmail = `${randomUSername}@flowback.test`;

    await page.goto('/login');
    await expect(page.locator('#login-page')).toBeVisible();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByLabel('Email').click();
    await page.getByLabel('Email').fill('a@a.se');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('You must accept terms of')).toBeVisible();
    await page.getByLabel('Yes').check();
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Email already exists.')).toBeVisible();

    await page.getByLabel('Email').fill(randomEmail);

    let registrationCode = '';
    await page.on('response', async (response: any) => {
        if (response.url().includes('register') && !response.url().includes('verify')) {
            registrationCode = await response.text()
        }
    });

    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Email Sent')).toBeVisible();
    await expect(page.getByText('Mail Sent')).toBeVisible();

    await page.getByLabel('Verification Code').click();
    await page.getByLabel('Verification Code').fill('geageageadgea');
    await page.getByLabel('Username').click();
    await page.getByLabel('Username').fill(randomUSername);
    await page.getByLabel('Choose a Password').click();
    await page.getByLabel('Choose a Password').fill('SecretPassword123123!');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Wrong verification code')).toBeVisible();
    await page.getByLabel('Verification Code').click();
    await page.getByLabel('Verification Code').press('Control+a');
    await page.getByLabel('Verification Code').fill(registrationCode.replace("\"", "").replace("\"", ""));

    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('Success')).toBeVisible();
    await expect(page).toHaveURL(`${process.env.LINK}/home`);

    if (await page.getByRole('button', { name: 'Ok' }).isVisible()) {
        await page.getByRole('button', { name: 'Ok' }).click();
    }
}

export async function logout(page: any) {
    await page.getByRole('button', { name: 'default pfp' }).click();
    await page.getByRole('button', { name: 'Log Out', exact: true }).click();
    await expect(page.getByRole('img', { name: 'flowback logo' })).toBeVisible();
};


export function randomString() {
    const rand = Math.random().toString(36).slice(2, 10);
    return rand
}