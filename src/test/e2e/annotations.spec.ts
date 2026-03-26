import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import path from 'path';

const HARNESS_URL = pathToFileURL(
  path.resolve('src/test/e2e/capture-harness.html'),
).toString();

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS_URL);
  await page.waitForSelector('.plan-review-view', { timeout: 10_000 });
  // Wait until at least one list item annotatable-block is present in the DOM.
  await page.waitForSelector('li.annotatable-block[data-line]', {
    timeout: 5_000,
  });
});

// ── Annotation Hover — Lista puntata ─────────────────────────────────────────
// Regressione per il bug: al hover su un <li class="annotatable-block">,
// il colore del testo diventava bianco (#fff) a causa di una regola CSS errata
// in annotations.css (li.annotatable-block:hover { color: #fff }).

test('hovering a list item keeps text color from theme — not white', async ({
  page,
}) => {
  const listItem = page.locator('li.annotatable-block[data-line]').first();
  await listItem.scrollIntoViewIfNeeded();
  await listItem.hover();

  const color = await listItem.evaluate((el) => getComputedStyle(el).color);

  // Before the fix, color was forced to rgb(255, 255, 255) by `color: #fff`.
  expect(color).not.toBe('rgb(255, 255, 255)');
});

test('hovering a list item does not produce an opaque overlay', async ({
  page,
}) => {
  const listItem = page.locator('li.annotatable-block[data-line]').first();
  await listItem.scrollIntoViewIfNeeded();
  await listItem.hover();

  // The ::before pseudo-element is the overlay. Verify the li background itself
  // stays transparent (not overridden by a solid color).
  const bgColor = await listItem.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );

  // Solid opaque grey (e.g. rgb(128, 128, 128)) would indicate the broken fallback.
  // Both transparent and rgba with low alpha are acceptable.
  expect(bgColor).not.toBe('rgb(128, 128, 128)');
  expect(bgColor).not.toMatch(/^rgb\(\d+, \d+, \d+\)$/); // no opaque solid color
});

test('non-list annotatable blocks still show hover highlight', async ({
  page,
}) => {
  // Verify that fixing the li regression did not break regular block hover.
  const paragraph = page.locator('p.annotatable-block[data-line]').first();
  await paragraph.scrollIntoViewIfNeeded();
  await paragraph.hover();

  // The paragraph should still be hoverable (block-comment-btn becomes visible).
  const btn = paragraph.locator('.block-comment-btn');
  await expect(btn).toBeVisible();
});
