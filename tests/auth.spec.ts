import { expect, test } from '@playwright/test'
import { signIn, signInAndWait } from './helpers'

test('a wrong password shows an error and stays on the sign-in page', async ({ page }) => {
  await signIn(page, 'client', 'not-the-password')
  await expect(page.getByRole('alert')).toContainText('do not match')
  await expect(page).toHaveURL(/\/login$/)
})

test('there is no way to sign up', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText(/sign up|create an account|register/i)).toHaveCount(0)
})

test('signed out, any page redirects to sign-in, and signing in returns to that page', async ({ page }) => {
  await page.goto('/questions')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Email').fill('client@example.com')
  await page.getByLabel('Password').fill('demo')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/questions$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Questions' })).toBeVisible()
})

test('the site shows nothing before signing in', async ({ page }) => {
  await page.goto('/blueprint')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Guided demo')).toHaveCount(0)
})

test('a signed-in person with no profile sees "No access yet"', async ({ page }) => {
  await signIn(page, 'nobody')
  await expect(page.getByRole('heading', { name: 'No access yet' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Blueprint' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('after signing out from the account page, the next sign-in does not go back to it', async ({ page }) => {
  await signInAndWait(page, 'client')
  await page.getByRole('link', { name: 'Your account' }).click()
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Email').fill('client@example.com')
  await page.getByLabel('Password').fill('demo')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /^Hello,/ })).toBeVisible()
  await expect(page).not.toHaveURL(/account/)
})

test('the password can be changed, with checks, and the new one works', async ({ page }) => {
  await signInAndWait(page, 'client')
  await page.goto('/account')
  const newPassword = page.getByLabel(/^New password(?! again)/)
  const again = page.getByLabel('New password again')

  await newPassword.fill('short')
  await again.fill('short')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByRole('alert')).toContainText('at least 10')

  await newPassword.fill('a-long-enough-one')
  await again.fill('a-different-one!!')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByRole('alert')).toContainText('not the same')

  await again.fill('a-long-enough-one')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page.getByRole('status')).toContainText('changed')

  await page.getByRole('button', { name: 'Sign out' }).click()
  await signIn(page, 'client', 'demo')
  await expect(page.getByRole('alert')).toBeVisible()
  await signIn(page, 'client', 'a-long-enough-one')
  await expect(page.getByRole('heading', { level: 1, name: /^Hello,/ })).toBeVisible()
})
