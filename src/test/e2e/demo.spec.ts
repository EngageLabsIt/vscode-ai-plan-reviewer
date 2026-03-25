import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import path from 'path';

const DEMO_URL = pathToFileURL(
  path.resolve('docs/plan-reviewer-demo.html'),
).toString();

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO_URL);
  await page.waitForSelector('.plan-viewer');
});

test('renders more than 40 line rows', async ({ page }) => {
  const count = await page.locator('.line-row').count();
  expect(count).toBeGreaterThan(40);
});

test('initial 4 comment cards are rendered inline', async ({ page }) => {
  await expect(page.locator('.comment-card-wrap')).toHaveCount(4);
});

test('hovering a line reveals the add button', async ({ page }) => {
  await page.locator('#line-5').hover();
  const addBtn = page.locator('#line-5 .add-btn');
  await expect(addBtn).toBeVisible();
});

test('clicking + on a line opens inline comment form', async ({ page }) => {
  await page.locator('#line-5').hover();
  await page.locator('#line-5 .add-btn').click();
  await expect(page.locator('.comment-form-inline')).toBeVisible();
});

test('Cancel closes the inline comment form', async ({ page }) => {
  await page.locator('#line-5').hover();
  await page.locator('#line-5 .add-btn').click();
  await page.locator('.comment-form-inline__btn--cancel').click();
  await expect(page.locator('.comment-form-inline')).not.toBeVisible();
});

test('submitting a comment from inline form creates a comment card', async ({
  page,
}) => {
  const initialCount = await page.locator('.comment-card-wrap').count();
  await page.locator('#line-5').hover();
  await page.locator('#line-5 .add-btn').click();
  await page.locator('#formTextarea').fill('Test inline comment');
  await page.locator('.comment-form-inline__btn--submit').click();
  await expect(page.locator('.comment-card-wrap')).toHaveCount(
    initialCount + 1,
  );
});

test('new comment body is visible in the inline card', async ({ page }) => {
  await page.locator('#line-5').hover();
  await page.locator('#line-5 .add-btn').click();
  await page.locator('#formTextarea').fill('Unique body text xyz123');
  await page.locator('.comment-form-inline__btn--submit').click();
  await expect(
    page.locator('.comment-body', { hasText: 'Unique body text xyz123' }),
  ).toBeVisible();
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
  await expect(firstCard.locator('.comment-body')).toContainText(
    'Updated body text',
  );
});

test('Delete button removes the comment card', async ({ page }) => {
  const initialCount = await page.locator('.comment-card-wrap').count();
  const firstCard = page.locator('.comment-card-wrap').first();
  await firstCard.hover();
  await firstCard.locator('.delete-btn').click();
  await expect(page.locator('.comment-card-wrap')).toHaveCount(
    initialCount - 1,
  );
});

test('opening navigator shows comment list without filter chips', async ({
  page,
}) => {
  await page.locator('#btnNav').click();
  await expect(page.locator('#navigator')).toBeVisible();
  await expect(page.locator('.filter-chip')).toHaveCount(0);
  const navItems = await page.locator('.nav-item').count();
  expect(navItems).toBeGreaterThan(0);
});

test('Generate Prompt button opens the modal with content', async ({
  page,
}) => {
  await page.locator('#btnPrompt').click();
  await expect(page.locator('.modal-overlay')).not.toHaveClass(/hidden/);
  const content = await page.locator('#promptContent').textContent();
  expect(content).not.toBe('');
});

test('switching to Full Context mode embeds the plan content', async ({
  page,
}) => {
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

// ── Search Feature Tests ────────────────────────────────────────────────

test.describe('Search Feature Tests', () => {
  test('Ctrl+F opens search bar with focused input', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await expect(page.locator('.search-bar')).toBeVisible();
    await expect(page.locator('.search-bar__input')).toBeFocused();
  });

  test('typing query shows search matches and counter', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.locator('.search-bar__input').fill('JWT');
    await expect(page.locator('.line-row--search-match').first()).toBeVisible();
    const count = page.locator('.search-bar__count');
    await expect(count).not.toHaveText('0 / 0');
  });

  test('Enter moves to next search match', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.locator('.search-bar__input').fill('JWT');
    await expect(page.locator('.line-row--search-current')).toHaveCount(1);
    const firstMatch = await page
      .locator('.line-row--search-current')
      .getAttribute('id');

    await page.locator('.search-bar__input').press('Enter');
    const secondMatch = await page
      .locator('.line-row--search-current')
      .getAttribute('id');

    const totalMatches = await page.locator('.line-row--search-match').count();
    if (totalMatches > 1) {
      expect(secondMatch).not.toBe(firstMatch);
    }
  });

  test('Escape closes search bar and removes highlights', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.locator('.search-bar__input').fill('JWT');
    await expect(page.locator('.line-row--search-match').first()).toBeVisible();

    await page.locator('.search-bar__input').press('Escape');
    await expect(page.locator('.search-bar')).toHaveCount(0);
    await expect(page.locator('.line-row--search-match')).toHaveCount(0);
  });
});

// ── Inline Comment Form & Selection Tests ───────────────────────────────

test.describe('Inline Comment Form', () => {
  test('inline form appears below the clicked line', async ({ page }) => {
    await page.locator('#line-5').hover();
    await page.locator('#line-5 .add-btn').click();
    const form = page.locator('.comment-form-inline');
    await expect(form).toBeVisible();
    await expect(page.locator('#formTextarea')).toBeVisible();
  });

  test('text selection highlights rows with .line-row--selecting', async ({
    page,
  }) => {
    const startRow = page.locator('#line-3 .line-content');
    const endRow = page.locator('#line-6 .line-content');
    const startBox = await startRow.boundingBox();
    const endBox = await endRow.boundingBox();
    if (!startBox || !endBox) throw new Error('Could not get bounding boxes');

    await page.mouse.move(startBox.x + 5, startBox.y + 5);
    await page.mouse.down();
    await page.mouse.move(endBox.x + 5, endBox.y + 5);
    await page.mouse.up();

    await expect(page.locator('.line-row--selecting')).toHaveCount(4);
  });

  test('text selection shows floating comment button', async ({ page }) => {
    const startRow = page.locator('#line-3 .line-content');
    const endRow = page.locator('#line-5 .line-content');
    const startBox = await startRow.boundingBox();
    const endBox = await endRow.boundingBox();
    if (!startBox || !endBox) throw new Error('Could not get bounding boxes');

    await page.mouse.move(startBox.x + 5, startBox.y + 5);
    await page.mouse.down();
    await page.mouse.move(endBox.x + 5, endBox.y + 5);
    await page.mouse.up();

    await expect(page.locator('.selection-comment-btn')).toBeVisible();
  });
});
