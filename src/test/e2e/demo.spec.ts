import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import path from 'path';

const DEMO_URL = pathToFileURL(
  path.resolve('docs/plan-reviewer-demo.html')
).toString();

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO_URL);
  await page.waitForSelector('.plan-viewer');
});

test('renders more than 40 line rows', async ({ page }) => {
  const count = await page.locator('.line-row').count();
  expect(count).toBeGreaterThan(40);
});

test('status bar is visible and shows comment count', async ({ page }) => {
  await expect(page.locator('.statusbar')).toBeVisible();
  await expect(page.locator('#sbComments')).toContainText('comments');
});

test('initial 4 comment cards are rendered inline', async ({ page }) => {
  await expect(page.locator('.comment-card-wrap')).toHaveCount(4);
});

test('hovering a line reveals the add button', async ({ page }) => {
  await page.locator('#line-5').hover();
  const addBtn = page.locator('#line-5 .add-btn');
  await expect(addBtn).toBeVisible();
});

test('clicking + on a line opens comment form with focused textarea', async ({ page }) => {
  await page.locator('#line-5').hover();
  await page.locator('#line-5 .add-btn').click();
  await expect(page.locator('.comment-form-wrap')).toBeVisible();
  await expect(page.locator('#formTextarea')).toBeFocused();
});

test('Cancel closes the comment form', async ({ page }) => {
  await page.locator('#line-5').hover();
  await page.locator('#line-5 .add-btn').click();
  await page.locator('.comment-form button', { hasText: 'Cancel' }).click();
  await expect(page.locator('.comment-form-wrap')).not.toBeVisible();
});

test('submitting a comment creates an inline comment card', async ({ page }) => {
  const initialCount = await page.locator('.comment-card-wrap').count();
  await page.locator('#line-5').hover();
  await page.locator('#line-5 .add-btn').click();
  await page.locator('#formTextarea').fill('Test comment for line 5');
  await page.locator('.comment-form button.primary').click();
  await expect(page.locator('.comment-card-wrap')).toHaveCount(initialCount + 1);
});

test('new comment body is visible in the inline card', async ({ page }) => {
  await page.locator('#line-5').hover();
  await page.locator('#line-5 .add-btn').click();
  await page.locator('#formTextarea').fill('Unique body text xyz123');
  await page.locator('.comment-form button.primary').click();
  await expect(page.locator('.comment-body', { hasText: 'Unique body text xyz123' })).toBeVisible();
});

test('Edit button puts the comment card into edit mode', async ({ page }) => {
  const firstCard = page.locator('.comment-card-wrap').first();
  await firstCard.hover();
  await firstCard.locator('.edit-btn').click();
  await expect(page.locator('.edit-area')).toBeVisible();
});

test('saving an edit updates the comment body', async ({ page }) => {
  const firstCard = page.locator('.comment-card-wrap').first();
  await firstCard.hover();
  await firstCard.locator('.edit-btn').click();
  await page.locator('.edit-area').clear();
  await page.locator('.edit-area').fill('Updated body text');
  await page.locator('.edit-actions button.primary').click();
  await expect(firstCard.locator('.comment-body')).toContainText('Updated body text');
});

test('Delete button removes the comment card', async ({ page }) => {
  const initialCount = await page.locator('.comment-card-wrap').count();
  const firstCard = page.locator('.comment-card-wrap').first();
  await firstCard.hover();
  await firstCard.locator('.delete-btn').click();
  await expect(page.locator('.comment-card-wrap')).toHaveCount(initialCount - 1);
});

test('shift-click after + shows range label in the form', async ({ page }) => {
  await page.locator('#line-10').hover();
  await page.locator('#line-10 .add-btn').click();
  await page.keyboard.down('Shift');
  await page.locator('#line-15').click();
  await page.keyboard.up('Shift');
  await expect(page.locator('.range-label')).toBeVisible();
  await expect(page.locator('.range-label')).toContainText('Commenting on lines');
});

test('opening navigator shows 4 filter chips', async ({ page }) => {
  await page.locator('#btnNav').click();
  await expect(page.locator('#navigator')).toBeVisible();
  await expect(page.locator('.filter-chip')).toHaveCount(4);
});

test('toggling a filter chip reduces visible nav items', async ({ page }) => {
  await page.locator('#btnNav').click();
  const initialCount = await page.locator('.nav-item').count();
  await page.locator('.filter-chip').first().click();
  const newCount = await page.locator('.nav-item').count();
  expect(newCount).toBeLessThan(initialCount);
});

test('section headings have collapse toggles', async ({ page }) => {
  const count = await page.locator('.section-toggle').count();
  expect(count).toBeGreaterThan(0);
});

test('clicking section toggle hides lines in that section', async ({ page }) => {
  const initialRows = await page.locator('.line-row').count();
  await page.locator('.section-toggle').first().click();
  const collapsedRows = await page.locator('.line-row').count();
  expect(collapsedRows).toBeLessThan(initialRows);
});

test('clicking toggle again re-expands the section', async ({ page }) => {
  const initialRows = await page.locator('.line-row').count();
  await page.locator('.section-toggle').first().click();
  await page.locator('.section-toggle').first().click();
  await expect(page.locator('.line-row')).toHaveCount(initialRows);
});

test('Generate Prompt button opens the modal with content', async ({ page }) => {
  await page.locator('#btnPrompt').click();
  await expect(page.locator('.modal-overlay')).not.toHaveClass(/hidden/);
  const content = await page.locator('#promptContent').textContent();
  expect(content).not.toBe('');
});

test('switching to Full Context mode embeds the plan content', async ({ page }) => {
  await page.locator('#btnPrompt').click();
  await page.locator('#modeFull').click();
  const content = await page.locator('#promptContent').textContent();
  expect(content).toContain('CREATE TABLE');
});

test('clicking the modal backdrop closes the modal', async ({ page }) => {
  await page.locator('#btnPrompt').click();
  await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('.modal-overlay')).toHaveClass(/hidden/);
});
