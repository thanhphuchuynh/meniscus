/**
 * The kit's top-layer behavior in real engines: focus, dismissal, stacking
 * and placement. Run the dev server first (`pnpm dev --host 127.0.0.1`).
 * WebKit and Firefox need `pnpm exec playwright install webkit firefox` once.
 * MENISCUS_ENGINES narrows the engines, e.g. "chromium".
 */
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const url = process.env.MENISCUS_TEST_URL ?? 'http://127.0.0.1:5173/components/';
const ENGINES = { chromium, webkit, firefox };
const names = (process.env.MENISCUS_ENGINES ?? 'chromium,webkit,firefox').split(',').map((s) => s.trim()).filter(Boolean);
const HEIGHT = 860;

for (const name of names) {
  const type = ENGINES[name];
  assert.ok(type, `unknown engine "${name}"`);
  let browser;
  try {
    browser = await type.launch();
  } catch (error) {
    throw new Error(`${name} isn't installed. Run \`pnpm exec playwright install ${name}\`.\n${error.message}`);
  }
  try {
    for (const width of [1280, 390]) {
      const where = `${name} at ${width}px`;
      const page = await browser.newPage({ viewport: { width, height: HEIGHT } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto(url);
      await page.locator('.splash').waitFor({ state: 'detached' }).catch(() => {});

      // Overlays arrive on springs: measure once the box stops moving.
      const settledBox = async (locator) => {
        let last = await locator.boundingBox();
        for (let i = 0; i < 40; i++) {
          await page.waitForTimeout(50);
          const next = await locator.boundingBox();
          if (last && next && Math.abs(next.x - last.x) < 0.5 && Math.abs(next.y - last.y) < 0.5 && Math.abs(next.width - last.width) < 0.5) return next;
          last = next;
        }
        return last;
      };
      const onScreen = async (locator, label) => {
        const box = await settledBox(locator);
        assert.ok(box, `${label} has a box (${where})`);
        assert.ok(box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= width + 0.5 && box.y + box.height <= HEIGHT + 0.5, `${label} stays on screen (${where}): ${JSON.stringify(box)}`);
      };
      const focusIn = (selector) => page.evaluate((s) => !!document.activeElement?.closest(s), selector);
      const focusedText = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
      const closed = () => page.waitForFunction(() => !document.querySelector('dialog[open]'));

      // Dialog: focus moves in and stays in; a toast shows above it; Escape closes it and focus returns.
      const order = page.getByRole('button', { name: 'Order a print', exact: true });
      await order.scrollIntoViewIfNeeded();
      await order.click();
      const dialog = page.getByRole('dialog', { name: 'Order a print' });
      await dialog.waitFor();
      assert.ok(await focusIn('dialog[open]'), `focus moves into the dialog (${where})`);
      for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
      assert.ok(await focusIn('dialog[open]'), `Tab stays inside the open dialog (${where})`);
      await dialog.getByRole('button', { name: 'Toast from the dialog' }).click();
      const region = page.getByRole('region', { name: 'Notifications' });
      await region.getByText('Proof requested').waitFor();
      assert.ok(await region.evaluate((el) => el.matches(':popover-open')), `the toaster is in the top layer (${where})`);
      await settledBox(region.getByRole('listitem').first());
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(tmpdir(), `meniscus-toast-over-modal-${name}-${width}.png`) });
      await page.keyboard.press('Escape');
      await closed();
      assert.equal(await focusedText(), 'Order a print', `focus returns to the dialog's trigger (${where})`);
      // Clear the toast, so it can't cover the controls the next steps press.
      await region.getByRole('button', { name: 'Dismiss notification' }).click();
      await region.getByText('Proof requested').waitFor({ state: 'detached' });

      // The dimmed page closes it too.
      await order.click();
      await dialog.waitFor();
      await page.mouse.click(4, 4);
      await closed();

      // Sheet and drawer.
      for (const [trigger, label] of [['Filters sheet', 'Filters'], ['Library drawer', 'Library']]) {
        await page.getByRole('button', { name: trigger }).click();
        const panel = page.getByRole('dialog', { name: label });
        await panel.waitFor();
        await onScreen(panel.locator('[data-meniscus]').first(), `the ${label} panel`);
        await page.keyboard.press('Escape');
        await closed();
      }

      // Popover: on screen, takes focus, Escape and an outside press close it.
      const share = page.getByRole('button', { name: 'Share', exact: true });
      await share.scrollIntoViewIfNeeded();
      await share.click();
      const popover = page.getByRole('dialog', { name: 'Share' });
      await popover.waitFor();
      await onScreen(popover, 'the Share popover');
      assert.ok(await focusIn('[role="dialog"][aria-label="Share"]'), `focus moves into the popover (${where})`);
      await page.keyboard.press('Escape');
      await popover.waitFor({ state: 'hidden' });
      assert.equal(await focusedText(), 'Share', `focus returns to the popover's trigger (${where})`);
      await share.click();
      await popover.waitFor();
      await page.getByRole('heading', { name: 'GlassPopover' }).click();
      await popover.waitFor({ state: 'hidden' });

      // Menu: the keyboard pattern, on screen, and a choice.
      const actions = page.getByRole('button', { name: 'Plate actions' });
      await actions.scrollIntoViewIfNeeded();
      await actions.focus();
      await page.keyboard.press('ArrowDown');
      const menu = page.getByRole('menu', { name: 'Plate actions' });
      await menu.waitFor();
      await onScreen(menu, 'the Plate actions menu');
      if (width >= 1280) {
        // Room below: the menu keeps its bottom-start placement instead of flipping.
        const [m, t] = await Promise.all([menu.boundingBox(), actions.boundingBox()]);
        assert.ok(m.y >= t.y + t.height - 1, `the menu opens below its trigger where there is room (${where})`);
      }
      assert.equal(await focusedText(), 'Open', `ArrowDown opens on the first item (${where})`);
      await page.keyboard.press('ArrowDown');
      assert.ok((await focusedText()).startsWith('Duplicate'), `ArrowDown moves (${where})`);
      await page.keyboard.press('End');
      assert.equal(await focusedText(), 'Details', `End skips the disabled item (${where})`);
      await page.keyboard.press('o');
      assert.equal(await focusedText(), 'Open', `a letter jumps (${where})`);
      await page.keyboard.press('Enter');
      await menu.waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('status').filter({ hasText: 'Opened.' }).count(), 1, `Enter chooses (${where})`);

      // Tooltip: hover shows it; Escape hides it.
      const save = page.getByRole('button', { name: 'Save', exact: true });
      await save.scrollIntoViewIfNeeded();
      await save.hover();
      const tip = page.getByRole('tooltip', { name: 'Save to collection' });
      await tip.waitFor({ timeout: 2000 });
      await onScreen(tip, 'the Save tooltip');
      await page.keyboard.press('Escape');
      await tip.waitFor({ state: 'hidden' });

      // Reduced motion: closing is a short fade.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await order.scrollIntoViewIfNeeded();
      await order.click();
      await dialog.waitFor();
      const started = Date.now();
      await page.keyboard.press('Escape');
      await closed();
      assert.ok(Date.now() - started < 600, `a reduced-motion close is quick (${where}): ${Date.now() - started} ms`);
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      assert.deepEqual(errors, [], `no errors (${where})`);
      await page.close();
      console.log(`ok ${where}`);
    }
  } finally {
    await browser.close();
  }
}
