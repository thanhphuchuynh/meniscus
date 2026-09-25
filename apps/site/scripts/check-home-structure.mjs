import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(process.env.MENISCUS_TEST_URL ?? 'http://127.0.0.1:5173/');
    await page.locator('.splash').waitFor({ state: 'detached' });

    const ids = await page.locator('main > section').evaluateAll((sections) => sections.map((section) => section.id || section.querySelector('h1,h2')?.textContent));
    // The evaluator's order: browser support and how it works before the quick start, examples next, experiments last.
    const order = ['browser-support', 'anatomy', 'try-online', 'specimens', 'surface-tension', 'interfaces', 'demos', 'depth', 'stack', 'finish'];
    assert.deepEqual(ids.filter((id) => order.includes(id)), order);
    assert.equal(await page.locator('#demos .media-video').count(), 1);
    assert.equal(await page.locator('#demos .media-music').count(), 1);
    assert.equal(await page.locator('#interfaces .media-video, #interfaces .pattern-gallery').count(), 0);
    assert.equal(await page.locator('#try-online .code').count(), 1);
    // One install line in the hero and one in the quick start; the masthead's is chrome.
    assert.equal(await page.locator('main .install').count(), 2);
    const index = await page.locator('.home-index a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    assert.deepEqual(index, ['#browser-support', '#anatomy', '#try-online', '#specimens', '#depth']);
    for (const anchor of index) assert.equal(await page.locator(anchor).count(), 1);
    await page.locator('#demos').screenshot({ path: `/private/tmp/meniscus-demos-${width}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    await page.goto(process.env.MENISCUS_COMPONENTS_URL ?? 'http://127.0.0.1:5173/components/');
    await page.locator('.splash').waitFor({ state: 'detached' });
    assert.equal(await page.locator('#patterns .comparison').count(), 4);
    const slider = page.locator('#patterns .comparison').first().getByRole('slider');
    await slider.focus();
    await page.keyboard.press('End');
    assert.equal(await slider.getAttribute('aria-valuenow'), '100');
    await page.locator('#patterns').screenshot({ path: `/private/tmp/meniscus-patterns-${width}.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Homepage order, anchors, media demos, Components patterns, and responsive widths passed.');
} finally {
  await browser.close();
}
