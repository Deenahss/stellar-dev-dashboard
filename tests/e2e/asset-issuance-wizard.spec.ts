import { test, expect } from '@playwright/test';

test.describe('testnet asset issuance wizard', () => {
  test('creates accounts with Friendbot fixtures and resumes without persisting signing keys', async ({ page }) => {
    const fundedAddresses: string[] = [];
    await page.route('https://friendbot.stellar.org/**', async (route) => {
      const address = new URL(route.request().url()).searchParams.get('addr');
      if (address) fundedAddresses.push(address);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ successful: true }) });
    });

    await page.goto('/assetIssuance');
    await expect(page.getByRole('heading', { name: 'Testnet asset issuance' })).toBeVisible();
    await page.getByLabel('Asset code').fill('DEMO');
    await page.getByLabel('Asset name').fill('Demo Credit');
    await page.getByLabel('Home domain').fill('example.org');
    await page.getByRole('button', { name: 'Create and fund accounts' }).click();

    await expect(page.getByText('Both testnet accounts are funded.')).toBeVisible();
    await expect.poll(() => fundedAddresses.length).toBe(2);
    const savedDraft = await page.evaluate(() => localStorage.getItem('stellar:asset-issuance:testnet:v1'));
    expect(savedDraft).toContain('DEMO');
    expect(savedDraft).not.toMatch(/S[A-Z2-7]{55}/);

    await page.reload();
    await expect(page.getByText('Issuer · funded')).toBeVisible();
    await expect(page.getByLabel('issuer secret key')).toHaveValue('');
    await expect(page.getByLabel('distributor secret key')).toHaveValue('');
  });

  test('shows a funding failure and keeps the draft retryable', async ({ page }) => {
    await page.route('https://friendbot.stellar.org/**', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'fixture outage' }) });
    });

    await page.goto('/assetIssuance');
    await page.getByLabel('Asset code').fill('FAIL');
    await page.getByLabel('Asset name').fill('Failure Fixture');
    await page.getByLabel('Home domain').fill('example.org');
    await page.getByRole('button', { name: 'Create and fund accounts' }).click();

    await expect(page.getByRole('alert')).toContainText('Faucet request failed');
    await expect(page.getByLabel('issuer secret key')).not.toHaveValue('');
    const savedDraft = await page.evaluate(() => localStorage.getItem('stellar:asset-issuance:testnet:v1'));
    expect(savedDraft).toContain('FAIL');
    expect(savedDraft).not.toMatch(/S[A-Z2-7]{55}/);
  });
});