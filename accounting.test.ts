import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { newWindow, register } from './generic'

const authorized = async (page: any) => ({
  Authorization: `Token ${await page.evaluate(() => localStorage.getItem('token'))}`,
})

// Needs FLOWBACK_LEDGER_MODULE=TRUE in the flowback-docker .env
test('Accounting: accounts, transactions, filters, paging, printable sheet, deletion and privacy', async ({ page }) => {
  test.setTimeout(240000)

  const bPage = await newWindow()
  await register(page)
  await register(bPage)

  const modal = page.locator('.modal-panel:visible')
  const accountRow = (name: string) => page.locator('[data-account-id]').filter({ hasText: name })
  const transactionRow = (description: string) => page.locator('[data-transaction-id]').filter({ hasText: description })
  const transactions = page.locator('[data-transaction-id]')

  const createAccount = async (name: string, number: string) => {
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await modal.getByLabel('Account name').fill(name)
    await modal.getByLabel('Account number').fill(number)
    await modal.getByRole('button', { name: 'Create account' }).click()
    await expect(accountRow(name)).toBeVisible()
  }

  const addTransaction = async (type: 'Debit' | 'Credit', amount: string, description: string, verification: string, account: string) => {
    await page.getByRole('button', { name: 'Add transaction' }).click()
    await modal.getByLabel(type, { exact: true }).check()
    await modal.getByLabel('Amount').fill(amount)
    await modal.getByLabel('Verification number').fill(verification)
    await modal.getByLabel('Description').fill(description)
    await modal.getByLabel('Account', { exact: true }).selectOption({ label: account })
    await modal.getByRole('button', { name: 'Create transaction' }).click()
    await expect(transactionRow(description)).toBeVisible()
  }

  await test.step('The module is reachable from the header', async () => {
    await page.locator('#accounting').click()
    await expect(page).toHaveURL(`${process.env.LINK}/accounting`)
    await expect(page.getByText('You have no accounts yet')).toBeVisible()
    await expect(page.getByText('No transactions found')).toBeVisible()
  })

  await test.step('Create and rename accounts', async () => {
    await createAccount('Wallet', '1930')
    await createAccount('Bank', '1910')
    await expect(accountRow('Wallet')).toContainText('1930')

    await accountRow('Wallet').getByRole('button', { name: 'Edit account' }).click()
    await expect(modal.getByLabel('Account name')).toHaveValue('Wallet')
    await modal.getByLabel('Account name').fill('Petty cash')
    await modal.getByRole('button', { name: 'Save' }).click()
    await expect(accountRow('Petty cash')).toContainText('1930')
    await expect(accountRow('Wallet')).toHaveCount(0)
  })

  await test.step('Add transactions and see balances', async () => {
    await page.getByRole('button', { name: 'Add transaction' }).click()
    await modal.getByRole('button', { name: 'Create transaction' }).click()
    await expect(page.getByText('The amount must be greater than zero').first()).toBeVisible()
    await modal.getByRole('button', { name: 'Close modal' }).click()

    await addTransaction('Debit', '100', 'Opening balance', 'V1', 'Petty cash 1930')
    await addTransaction('Credit', '30', 'Rent', 'V2', 'Bank 1910')
    await addTransaction('Credit', '10', 'Coffee', 'V3', 'Petty cash 1930')

    await expect(transactionRow('Opening balance')).toContainText('V1')
    await expect(accountRow('Petty cash')).toContainText('90')
    await expect(accountRow('Bank')).toContainText('-30')
    await expect(page.locator('#accounting-total-balance')).toContainText(/Total balance\s*60/)
  })

  await test.step('Edit a credit transaction and move it to another account', async () => {
    await transactionRow('Rent').getByRole('button', { name: 'Edit transaction' }).click()
    await expect(modal.getByLabel('Credit', { exact: true })).toBeChecked()
    await expect(modal.getByLabel('Amount')).toHaveValue('30')
    await modal.getByLabel('Description').fill('Office rent')
    await modal.getByRole('button', { name: 'Save' }).click()
    await expect(transactionRow('Office rent')).toBeVisible()
    await expect(accountRow('Bank')).toContainText('-30')

    await transactionRow('Coffee').getByRole('button', { name: 'Edit transaction' }).click()
    await modal.getByLabel('Amount').fill('20')
    await modal.getByLabel('Account', { exact: true }).selectOption({ label: 'Bank 1910' })
    await modal.getByRole('button', { name: 'Save' }).click()

    await expect(transactionRow('Coffee')).toContainText('Bank')
    await expect(transactionRow('Coffee')).toContainText('20')
    await expect(accountRow('Petty cash')).toContainText('100')
    await expect(accountRow('Bank')).toContainText('-50')
    await expect(page.locator('#accounting-total-balance')).toContainText(/Total balance\s*50/)
  })

  await test.step('Another user sees none of it', async () => {
    await bPage.goto(`${process.env.LINK}/accounting`)
    await expect(bPage.getByText('You have no accounts yet')).toBeVisible()
    await expect(bPage.getByText('No transactions found')).toBeVisible()

    const headers = await authorized(bPage)
    const accounts = await (await bPage.request.get(`${process.env.LINK}/api/ledger/account/list`, { headers })).json()
    const others = await (await bPage.request.get(`${process.env.LINK}/api/ledger/transactions/list`, { headers })).json()
    expect(accounts.count).toBe(0)
    expect(others.count).toBe(0)

    const accountId = await page.locator('[data-account-id]').first().getAttribute('data-account-id')
    const forbidden = await bPage.request.post(`${process.env.LINK}/api/ledger/account/${accountId}/delete`, { headers })
    expect(forbidden.status()).toBe(400)
    await expect(accountRow('Petty cash')).toBeVisible()
  })

  await test.step('Filter by description, account and date', async () => {
    await expect(transactions).toHaveCount(3)
    await page.locator('#accounting-search').fill('rent')
    await expect(transactions).toHaveCount(1)
    await expect(transactionRow('Office rent')).toBeVisible()
    await page.getByRole('button', { name: 'Clear Filter' }).click()
    await expect(transactions).toHaveCount(3)
    await expect(page.locator('#accounting-search')).toHaveValue('')

    await accountRow('Bank').locator('button[aria-pressed]').click()
    await expect(accountRow('Bank').locator('button[aria-pressed="true"]')).toBeVisible()
    await expect(transactions).toHaveCount(2)
    await expect(page.locator('#accounting-total-balance')).toContainText(/Total balance\s*-50/)
    await page.getByRole('button', { name: 'Clear Filter' }).click()
    await expect(transactions).toHaveCount(3)

    await page.locator('.date-time-field input').first().fill('2040-01-01')
    await expect(page.getByText('No transactions found')).toBeVisible()
    await page.getByRole('button', { name: 'Clear Filter' }).click()
    await expect(transactions).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Clear Filter' })).toHaveCount(0)
  })

  await test.step('Download the printable sheet', async () => {
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Generate Printable HTML file' }).click()
    const sheet = readFileSync(await (await download).path(), 'utf8')

    expect(sheet).toMatch(/Petty cash<\/td><td class="amount">100\.00</)
    expect(sheet).toMatch(/Bank<\/td><td class="amount">-50\.00</)
    expect(sheet).toMatch(/Total balance<\/td><td class="amount">50\.00</)
  })

  await test.step('Page through many transactions', async () => {
    const accountId = await accountRow('Bank').getAttribute('data-account-id')
    const headers = await authorized(page)
    for (let i = 1; i <= 20; i++) {
      const created = await page.request.post(`${process.env.LINK}/api/ledger/account/${accountId}/transactions/create`, {
        headers,
        data: { debit_amount: 0, credit_amount: 1, description: `Bulk ${i}`, verification_number: `B${i}` },
      })
      expect(created.ok()).toBe(true)
    }

    await page.reload()
    await expect(transactions).toHaveCount(20)
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(transactions).toHaveCount(3)

    await page.reload()
    await page.locator('#accounting-limit').selectOption('50')
    await expect(transactions).toHaveCount(23)
    await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0)
  })

  await test.step('Delete a transaction and an account', async () => {
    await transactionRow('Opening balance').getByRole('button', { name: 'Delete transaction' }).click()
    await modal.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(transactionRow('Opening balance')).toHaveCount(0)
    await expect(accountRow('Petty cash')).toContainText('0')

    await accountRow('Bank').getByRole('button', { name: 'Remove account' }).click()
    await modal.getByRole('button', { name: 'Delete Account' }).click()
    await expect(accountRow('Bank')).toHaveCount(0)
    await expect(page.getByText('No transactions found')).toBeVisible()
    await expect(accountRow('Petty cash')).toBeVisible()
  })
})
