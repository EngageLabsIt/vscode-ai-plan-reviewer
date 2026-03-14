import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import path from 'path';
import { mkdirSync } from 'fs';

const HARNESS_URL = pathToFileURL(
  path.resolve('src/test/e2e/capture-harness.html'),
).toString();
const SCREENSHOT_DIR = path.resolve('docs/screenshots');

test.beforeAll(() => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS_URL);
  await page.waitForSelector('.plan-viewer', { timeout: 10_000 });
  await page.waitForSelector('.plan-viewer .comment-card-wrap', { timeout: 5_000 });
});

// ── Screenshot tests ──────────────────────────────────────────────────────

test('overview @capture', async ({ page }) => {
  test.slow();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'overview.png'),
    fullPage: false,
  });
});

test('toolbar @capture', async ({ page }) => {
  test.slow();
  await page.locator('.review-toolbar').screenshot({
    path: path.join(SCREENSHOT_DIR, 'toolbar.png'),
  });
});

test('comment-card @capture', async ({ page }) => {
  test.slow();
  await page.locator('.plan-viewer .comment-card-wrap').first().scrollIntoViewIfNeeded();
  await page.locator('.plan-viewer .comment-card-wrap').first().screenshot({
    path: path.join(SCREENSHOT_DIR, 'comment-card.png'),
  });
});

test('navigator-open @capture', async ({ page }) => {
  test.slow();
  await page.locator('.review-toolbar__btn--comments').click();
  await page.waitForSelector('.comment-navigator--open', { timeout: 3_000 });
  await page.locator('.plan-content-area').screenshot({
    path: path.join(SCREENSHOT_DIR, 'navigator-open.png'),
  });
});

test('search-active @capture', async ({ page }) => {
  test.slow();
  await page.keyboard.press('Control+f');
  await page.locator('.search-bar__input').fill('JWT');
  await page.waitForSelector('.line-row--search-match', { timeout: 3_000 });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'search-active.png'),
  });
});

test('prompt-modal @capture', async ({ page }) => {
  test.slow();
  await page.locator('button:has-text("Generate Prompt")').click();
  await page.waitForSelector('.prompt-preview', { timeout: 3_000 });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'prompt-modal.png'),
  });
});

test('inline-form @capture', async ({ page }) => {
  test.slow();
  await page.locator('#line-38 .line-gutter').hover();
  await page.locator('#line-38 .line-gutter-add').click();
  await page.waitForSelector('.comment-form-inline', { timeout: 3_000 });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'inline-form.png'),
  });
});

test('text-selection @capture', async ({ page }) => {
  test.slow();
  await page.locator('#line-47').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  const startEl = page.locator('#line-47 .line-content');
  const endEl = page.locator('#line-48 .line-content');
  const startBox = await startEl.boundingBox();
  const endBox = await endEl.boundingBox();
  if (!startBox || !endBox) throw new Error('Could not get bounding boxes');

  await page.mouse.move(startBox.x + 10, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width - 10, endBox.y + endBox.height / 2);
  await page.mouse.up();

  await page.waitForSelector('.selection-comment-btn', { timeout: 5_000 });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'text-selection.png'),
  });
});

// ── Video flow tests ──────────────────────────────────────────────────────

test('flow-add-comment @capture', async ({ page }) => {
  test.slow();
  const initialCount = await page.locator('.plan-viewer .comment-card-wrap').count();

  await page.locator('#line-38 .line-gutter').hover();
  await page.waitForTimeout(300);

  await page.locator('#line-38 .line-gutter-add').click();
  await page.waitForSelector('.comment-form-inline', { timeout: 3_000 });
  await page.waitForTimeout(300);

  await page.locator('.comment-form-inline textarea').pressSequentially(
    'This column should have a NOT NULL constraint for data integrity.',
    { delay: 30 },
  );
  await page.waitForTimeout(300);

  await page.locator('.comment-form-inline__btn--submit').click();
  await expect(page.locator('.plan-viewer .comment-card-wrap')).toHaveCount(initialCount + 1);
  await page.waitForTimeout(500);
});

test('flow-search @capture', async ({ page }) => {
  test.slow();
  await page.keyboard.press('Control+f');
  await page.waitForSelector('.search-bar__input', { timeout: 3_000 });
  await page.waitForTimeout(300);

  await page.locator('.search-bar__input').pressSequentially('JWT', { delay: 80 });
  await page.waitForSelector('.line-row--search-match', { timeout: 3_000 });
  await page.waitForTimeout(400);

  await page.locator('.search-bar__input').press('Enter');
  await page.waitForTimeout(400);
  await page.locator('.search-bar__input').press('Enter');
  await page.waitForTimeout(400);

  await page.locator('.search-bar__input').press('Escape');
  await page.waitForTimeout(500);
});

test('flow-generate-prompt @capture', async ({ page }) => {
  test.slow();
  await page.locator('button:has-text("Generate Prompt")').click();
  await page.waitForSelector('.prompt-preview', { timeout: 3_000 });
  await page.waitForTimeout(500);

  await page.locator('button:has-text("Full context")').click();
  await page.waitForTimeout(500);

  await page.locator('.prompt-preview__backdrop').click({ force: true });
  await page.waitForTimeout(500);
});

test('flow-navigator @capture', async ({ page }) => {
  test.slow();
  await page.locator('.review-toolbar__btn--comments').click();
  await page.waitForSelector('.comment-navigator--open', { timeout: 3_000 });
  await page.waitForTimeout(400);

  const navItem = page.locator('.comment-navigator__section-comment-item').first();
  if (await navItem.count() > 0) {
    await navItem.click();
    await page.waitForTimeout(400);
  }

  await page.locator('.review-toolbar__btn--comments').click();
  await page.waitForTimeout(500);
});

test('flow-text-selection @capture', async ({ page }) => {
  test.slow();
  await page.locator('#line-47').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  const startEl = page.locator('#line-47 .line-content');
  const endEl = page.locator('#line-48 .line-content');
  const startBox = await startEl.boundingBox();
  const endBox = await endEl.boundingBox();
  if (!startBox || !endBox) throw new Error('Could not get bounding boxes');

  await page.mouse.move(startBox.x + 10, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width - 10, endBox.y + endBox.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(300);

  await page.waitForSelector('.selection-comment-btn', { timeout: 5_000 });
  await page.locator('.selection-comment-btn').click();
  await page.waitForSelector('.comment-form-inline', { timeout: 3_000 });
  await page.waitForTimeout(300);

  await page.locator('.comment-form-inline textarea').pressSequentially(
    'These rate limits seem reasonable for production use.',
    { delay: 30 },
  );
  await page.waitForTimeout(300);

  const initialCount = await page.locator('.plan-viewer .comment-card-wrap').count();
  await page.locator('.comment-form-inline__btn--submit').click();
  await expect(page.locator('.plan-viewer .comment-card-wrap')).toHaveCount(initialCount + 1);
  await page.waitForTimeout(500);
});
