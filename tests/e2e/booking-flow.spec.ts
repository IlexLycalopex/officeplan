import { test, expect } from '@playwright/test'

// E2E tests require a running local Supabase instance and dev server.
// Run: supabase start && pnpm dev
// Then: pnpm test:e2e

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'test@acme.example'

test.describe('Authentication', () => {
  test('sign-in page renders', async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page.locator('h1', { hasText: 'Locustworks' })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('shows confirmation after magic-link request', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`)
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Check your email')).toBeVisible()
  })
})

test.describe('Home dashboard (authenticated)', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('home page loads with quick actions', async ({ page }) => {
    await page.goto(`${BASE_URL}/home`)
    await expect(page.locator('text=Book a desk')).toBeVisible()
    await expect(page.locator('text=My rota')).toBeVisible()
  })
})

test.describe('Floor map and booking', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('book desk page renders office selector', async ({ page }) => {
    await page.goto(`${BASE_URL}/book`)
    await expect(page.locator('select').first()).toBeVisible()
  })
})

test.describe('Rota', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' })

  test('rota page shows 5-day grid', async ({ page }) => {
    await page.goto(`${BASE_URL}/rota`)
    await expect(page.locator('text=My Rota')).toBeVisible()
    // 5 weekday columns
    const cols = page.locator('button').filter({ hasText: /In Office|Remote|Leave|Unavailable|—/ })
    await expect(cols).toHaveCount(5)
  })
})
