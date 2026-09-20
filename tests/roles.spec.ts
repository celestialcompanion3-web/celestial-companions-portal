import { expect, test } from '@playwright/test'
import { Q1, Q2, Q3, question, signInAndWait } from './helpers'

test.describe('overview', () => {
  test('the Blueprint is pinned at the top, above what is waiting', async ({ page }) => {
    await signInAndWait(page, 'client')
    const blueprint = page.locator('.card.featured')
    await expect(blueprint).toContainText('Blueprint')
    const a = await blueprint.boundingBox()
    const b = await page.locator('.stat-row').boundingBox()
    expect(a!.y).toBeLessThan(b!.y)
  })

  test('the client sees what is waiting for her, the demo, the latest update and the latest report', async ({ page }) => {
    await signInAndWait(page, 'client')
    await expect(page.locator('.stat', { hasText: 'questions waiting for you' }).locator('b')).toHaveText('2')
    await expect(page.getByRole('heading', { name: 'Try the live demo' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Latest update' })).toBeVisible()
    // The only weekly report is still a draft, so the client sees no "latest report" yet.
    await expect(page.getByRole('heading', { name: 'Latest weekly report' })).toHaveCount(0)
  })

  test('the owner sees what is waiting on the client, and her own draft report', async ({ page }) => {
    await signInAndWait(page, 'owner')
    await expect(page.locator('.stat', { hasText: 'questions waiting on Ms Sample' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Latest weekly report' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Manage' })).toBeVisible()
  })

  test('a viewer and a client have no Manage screen', async ({ page }) => {
    await signInAndWait(page, 'viewer')
    await expect(page.getByRole('link', { name: 'Manage' })).toHaveCount(0)
    await page.goto('/manage')
    await expect(page.getByRole('heading', { level: 1, name: /^Hello,/ })).toBeVisible()
  })
})

test.describe('answers', () => {
  test('the box is replaced by the saved text; the pen edits; Esc cancels; Ctrl+Enter saves', async ({ page }) => {
    await signInAndWait(page, 'client')
    await page.goto('/blueprint')
    const card = question(page, Q1)
    const box = card.getByRole('textbox', { name: /Your answer to/ })

    // Save is disabled until there is something to save.
    await expect(card.getByRole('button', { name: 'Save answer' })).toBeDisabled()
    await box.fill('Two weeks feels right.')
    await card.getByRole('button', { name: 'Save answer' }).click()

    // The input is gone, and her text is shown in its place.
    await expect(card.getByRole('textbox')).toHaveCount(0)
    await expect(card.locator('.answer-text')).toHaveText('Two weeks feels right.')
    await expect(card).not.toContainText('Edited')

    // The pen opens the editor; Save is disabled while nothing has changed.
    await card.getByRole('button', { name: 'Edit', exact: true }).click()
    const editor = card.getByRole('textbox', { name: 'Edit your text' })
    await expect(editor).toHaveValue('Two weeks feels right.')
    await expect(card.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    // Esc cancels and keeps the old text.
    await editor.fill('Something else entirely')
    await editor.press('Escape')
    await expect(card.getByRole('textbox')).toHaveCount(0)
    await expect(card.locator('.answer-text')).toHaveText('Two weeks feels right.')

    // Double-click also edits; Ctrl+Enter saves and stamps the edited time.
    await card.locator('.answer-text').dblclick()
    await editor.fill('Two to three weeks.')
    await editor.press('Control+Enter')
    await expect(card.locator('.answer-text')).toHaveText('Two to three weeks.')
    await expect(card).toContainText('Edited')
  })

  test('an answer survives a reload and is shown in place of the box', async ({ page }) => {
    await signInAndWait(page, 'client')
    await page.goto('/questions')
    await question(page, Q1).getByRole('textbox').fill('A saved answer')
    await question(page, Q1).getByRole('button', { name: 'Save answer' }).click()
    await page.reload()
    await expect(question(page, Q1).locator('.answer-text')).toHaveText('A saved answer')
    await expect(question(page, Q1).getByRole('textbox')).toHaveCount(0)
  })

  test('a closed question shows its note and takes no new answer', async ({ page }) => {
    await signInAndWait(page, 'client')
    await page.goto('/blueprint')
    const card = question(page, Q2)
    await expect(card).toContainText('Answered by email')
    await expect(card.getByRole('textbox')).toHaveCount(0)
    await expect(card.getByText('Closed', { exact: true })).toBeVisible()
  })

  test('the owner has no answer box, only Reply, and the client then sees the reply', async ({ page }) => {
    await signInAndWait(page, 'owner')
    await page.goto('/blueprint')
    const card = question(page, Q3)
    await expect(question(page, Q1).getByRole('textbox')).toHaveCount(0)
    await expect(card.locator('.reply')).toContainText('A sample reply')

    await card.getByRole('button', { name: 'Reply', exact: true }).click()
    const write = card.getByRole('textbox', { name: 'Write a reply' })
    await write.fill('A second reply from the owner.')
    await write.press('Control+Enter')
    await expect(card.locator('.reply').nth(1)).toContainText('A second reply from the owner.')

    await page.getByRole('link', { name: 'Your account' }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signInAndWait(page, 'client')
    await page.goto('/blueprint')
    await expect(question(page, Q3).locator('.reply')).toHaveCount(2)
  })

  test('a viewer can read everything and write nothing', async ({ page }) => {
    await signInAndWait(page, 'viewer')
    await page.goto('/blueprint')
    await expect(question(page, Q3).locator('.answer-text').first()).toBeVisible()
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Reply' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  })

  test('every page ends with a comments box, and a comment can be posted', async ({ page }) => {
    await signInAndWait(page, 'client')
    await page.goto('/blueprint')
    await page.getByRole('textbox', { name: 'Add a comment' }).fill('A comment on the blueprint')
    await page.getByRole('button', { name: 'Post comment' }).click()
    await expect(page.locator('.comment')).toContainText('A comment on the blueprint')
    // The comments box is the last thing on the page.
    await expect(page.locator('main > article > *').last()).toHaveClass(/thread/)
  })

  test('a weekly report is a draft: the client cannot open it, the owner can and it has a comments box', async ({ page }) => {
    await signInAndWait(page, 'client')
    await page.goto('/reports/week-2026-09-14')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await page.goto('/reports')
    await expect(page.getByText('No reports yet.')).toBeVisible()

    await page.getByRole('link', { name: 'Your account' }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await signInAndWait(page, 'owner')
    await page.goto('/reports/week-2026-09-14')
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Add a comment' })).toBeVisible()
  })
})
