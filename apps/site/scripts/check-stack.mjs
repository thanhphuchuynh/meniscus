import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const url = process.env.MENISCUS_TEST_URL ?? 'http://127.0.0.1:5173/';
const engines = (process.env.MENISCUS_BROWSERS ?? 'chromium,webkit').split(',');
const period = (k, m = 1) => 2 * Math.PI * Math.sqrt(m / k);

for (const name of engines) {
  const browser = await { chromium, webkit }[name].launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(url);
    await page.locator('.splash').waitFor({ state: 'detached' });
    const stage = page.locator('.stack__stage');
    await stage.scrollIntoViewIfNeeded();
    const card = page.locator('.stack__card');
    const side = page.locator('.stack__sidebar');
    assert.equal(await card.getAttribute('data-meniscus'), name === 'chromium' ? 'refract' : 'webgl', `${name}: card path`);

    // A wide stagger, so frame timing can't hide it.
    const stagger = page.getByLabel('Stagger', { exact: true });
    await stagger.fill('0.6');
    const toggle = page.getByRole('button', { name: /panes/ });
    await toggle.click();
    await page.waitForTimeout(1500);
    assert.equal(await card.evaluate((el) => el.hasAttribute('inert')), true, `${name}: closed layers are inert`);
    await page.evaluate(() => {
      const els = [document.querySelector('.stack__card'), document.querySelector('.stack__sidebar')];
      window.__starts = [null, null];
      const t0 = performance.now();
      const tick = () => {
        els.forEach((el, i) => {
          if (window.__starts[i] === null && Number(el.style.getPropertyValue('--meniscus-presence') || 0) > 0.02) window.__starts[i] = performance.now() - t0;
        });
        if (window.__starts.includes(null) && performance.now() - t0 < 3000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await toggle.click();
    await page.waitForTimeout(1600);
    const [cardStart, sideStart] = await page.evaluate(() => window.__starts);
    const expected = 0.6 * period(300) * 1000;
    assert.ok(Math.abs(sideStart - cardStart - expected) < 70, `${name}: stagger ${sideStart - cardStart} ms, expected ${expected.toFixed(0)}`);

    // Compounding: the card's pixels change when the sidebar moves beneath it.
    const overlap = async () => {
      const c = await card.boundingBox();
      const s = await side.boundingBox();
      const x = Math.max(c.x, s.x) + 4;
      const w = Math.min(c.x + c.width, s.x + s.width) - x - 4;
      const shot = await page.screenshot({ clip: { x, y: c.y + 12, width: Math.max(8, w), height: 40 } });
      return shot;
    };
    await card.evaluate((el) => { el.style.left = '150px'; el.style.top = '60px'; });
    await page.waitForTimeout(400);
    const before = await overlap();
    await side.evaluate((el) => { el.style.top = '90px'; });
    await page.waitForTimeout(400);
    const after = await overlap();
    assert.ok(!before.equals(after), `${name}: the card refracts the sidebar beneath it`);
    // A lower layer that changes size without moving still redraws the glass above it:
    // compare one fixed region, the card, as the sidebar's edge moves under it.
    const cardBox = await card.boundingBox();
    const cardShot = () => page.screenshot({ clip: { x: cardBox.x + 8, y: cardBox.y + 8, width: cardBox.width - 16, height: cardBox.height - 16 } });
    const narrow = await cardShot();
    await side.evaluate((el) => { el.style.width = '300px'; });
    await page.waitForTimeout(400);
    const wide = await cardShot();
    assert.ok(!narrow.equals(wide), `${name}: the card redraws when the sidebar beneath it resizes`);
    assert.deepEqual(errors, [], `${name}: page errors`);
    console.log(JSON.stringify({ engine: name, result: 'PASS', stagger: Math.round(sideStart - cardStart), expected: Math.round(expected) }));
  } finally {
    await browser.close();
  }
}
