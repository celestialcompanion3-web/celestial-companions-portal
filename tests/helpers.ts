import { expect, type Page } from '@playwright/test'

export type Who = 'owner' | 'client' | 'viewer' | 'nobody'

export async function signIn(page: Page, who: Who, password = 'demo') {
  await page.goto('/login')
  await page.getByLabel('Email').fill(`${who}@example.com`)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

export async function signInAndWait(page: Page, who: Exclude<Who, 'nobody'>) {
  await signIn(page, who)
  await expect(page.getByRole('heading', { level: 1, name: /^Hello,/ })).toBeVisible()
}

// One question's card, found by a few words from its prompt.
export const question = (page: Page, words: string) => page.locator('section.question', { hasText: words })

export const Q1 = 'How long is a family willing to wait'
export const Q2 = 'Who would finish each companion by hand'
export const Q3 = 'What should a family end up with'

export async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}
