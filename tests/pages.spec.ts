import { expect, test } from '@playwright/test'
import { noSideScroll, signInAndWait } from './helpers'

test('the blueprint draws its diagrams and keeps the schedule chart', async ({ page }) => {
  await signInAndWait(page, 'client')
  await page.goto('/blueprint')
  await expect(page.locator('.prose pre.mermaid svg').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.prose .wf-bar').first()).toBeVisible()
  // The chart's bars are placed with inline styles, which must survive the sanitiser.
  const style = await page.locator('.prose .wf-bar').first().getAttribute('style')
  expect(style).toContain('grid-column')
  // Contents links point at real heading ids.
  const firstLink = page.locator('.toc a').first()
  const href = await firstLink.getAttribute('href')
  await expect(page.locator(href!)).toHaveCount(1)
})

test('the theme follows the system, can be switched by hand, and resets on reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await signInAndWait(page, 'client')
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const dark = await bg()
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await bg()).not.toBe(dark)
  // Nothing is stored, so a reload goes back to the system setting.
  await page.reload()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
  expect(await bg()).toBe(dark)
})

test('progress: the demo can be previewed, with a fallback message, and every update has a date', async ({ page }) => {
  await signInAndWait(page, 'client')
  await page.goto('/progress')
  await expect(page.getByRole('link', { name: /Open the demo/ })).toHaveAttribute('href', 'https://demo.invalid/companion')
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('button', { name: 'Preview it here' }).click()
  await expect(page.locator('iframe[title="Live demo"]')).toBeVisible()
  await expect(page.getByText('If this stays blank')).toBeVisible()

  const entries = page.locator('.timeline > li')
  await expect(entries).toHaveCount(7)
  await expect(entries.first().locator('.when')).toContainText('2026')
})

test('decisions are grouped: still to decide, decided, parked', async ({ page }) => {
  await signInAndWait(page, 'viewer')
  await page.goto('/decisions')
  await expect(page.getByRole('heading', { name: 'Still to decide' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Decided', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Parked for later' })).toBeVisible()
  await expect(page.locator('.decision')).toHaveCount(8)
})

test('the Questions page separates waiting from answered or closed', async ({ page }) => {
  await signInAndWait(page, 'client')
  await page.goto('/questions')
  await expect(page.getByRole('heading', { name: 'Waiting for you' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Answered or closed' })).toBeVisible()
  await expect(page.locator('section.question')).toHaveCount(4)
  await expect(page.getByText('From Celestial Companions Blueprint').first()).toBeVisible()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 800 } })

  for (const path of ['/', '/blueprint', '/progress', '/questions', '/decisions', '/account']) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await signInAndWait(page, 'client')
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      await page.waitForTimeout(400)
      await noSideScroll(page)
    })
  }

  test('the owner\'s Manage screen fits too', async ({ page }) => {
    await signInAndWait(page, 'owner')
    await page.goto('/manage')
    await page.getByRole('tab', { name: 'Documents' }).click()
    await page.getByRole('button', { name: 'Add document' }).click()
    await noSideScroll(page)
  })

  test('the sign-in page fits', async ({ page }) => {
    await page.goto('/login')
    await noSideScroll(page)
  })
})
