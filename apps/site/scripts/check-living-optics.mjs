import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(process.env.MENISCUS_TEST_URL ?? 'http://127.0.0.1:5173/');
  await page.locator('.splash').waitFor({ state: 'detached' });
  const lens = page.locator('.plate-one__lens');
  assert.equal(await lens.getAttribute('data-meniscus'), 'webgl', 'a rippling lens over the engraving draws in WebGL');
  await lens.focus();
  const beforeKey = await lens.evaluate(el => parseFloat(el.style.left));
  await page.keyboard.press('ArrowRight');
  assert.equal(await lens.evaluate(el => parseFloat(el.style.left)), beforeKey + 10);
  const box = await lens.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 55, box.y + box.height / 2 + 45, { steps: 5 });
  // Release right after the last move: the lens counts a throw only within 100 ms of it.
  await page.mouse.up();
  const release = await lens.evaluate(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }));
  await page.waitForTimeout(120);
  const carried = await lens.evaluate(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }));
  assert.match(await lens.evaluate(el => el.style.transform), /^matrix\(/, 'a flung lens squashes');
  assert.ok(Math.hypot(carried.x - release.x, carried.y - release.y) > 1, 'flick must continue after release');
  await page.waitForTimeout(2400);
  const settled = await lens.getAttribute('style');
  await page.waitForTimeout(200);
  assert.equal(await lens.getAttribute('style'), settled, 'lens must stop scheduling positional motion');
  assert.equal(await lens.evaluate(el => el.style.transform), '', 'squash gives the transform back');
  await page.getByLabel('Refractive index n', { exact: true }).fill('2.42');
  assert.match(await page.locator('.plate-one__figure').innerText(), /2\.42/);
  // A tap rings the lens: frames change, then the surface settles.
  const tapBox = await lens.boundingBox();
  await page.mouse.click(tapBox.x + tapBox.width * 0.62, tapBox.y + tapBox.height * 0.4);
  const ring1 = await lens.screenshot(); await page.waitForTimeout(90); const ring2 = await lens.screenshot();
  assert.ok(!ring1.equals(ring2), 'waves move across the lens');
  await page.waitForTimeout(3300);
  const rest1 = await lens.screenshot(); await page.waitForTimeout(300); const rest2 = await lens.screenshot();
  assert.ok(rest1.equals(rest2), 'the surface settles');
  if (process.env.MENISCUS_CAPTURE) await page.screenshot({ path: join(tmpdir(), 'meniscus-living-desktop.png') });
  const depth = page.locator('.depth__stage');
  await depth.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.depth__stage')?.dataset.meniscusStage === 'ready');
  await depth.focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('.depth__pane').last().getAttribute('style'), /translate\(13\.2/);
  await page.waitForTimeout(200);
  if (process.env.MENISCUS_CAPTURE) await page.locator('#depth').screenshot({ path: join(tmpdir(), 'meniscus-depth.png') });

  // Test actual GPU pixels: layered output differs, no GL errors, no upside-down
  // framebuffer copy, and resize/context restoration remain valid.
  const gpu = await page.evaluate(async (root) => {
    const { GlassRenderer } = await import(`/@fs${root}packages/meniscus/src/webgl/renderer.ts`);
    const { resolveGlass } = await import(`/@fs${root}packages/meniscus/src/core/glass.ts`);
    const { RippleField } = await import(`/@fs${root}packages/meniscus/src/core/ripple.ts`);
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120;
    const source = document.createElement('canvas'); source.width = 160; source.height = 120;
    const ctx = source.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 160, 120);
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 160, 30);
    ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 90, 160, 30);
    ctx.fillStyle = '#101010'; for (let x = 20; x < 140; x += 8) ctx.fillRect(x, 32, 2, 56);
    const renderer = new GlassRenderer(canvas);
    renderer.setSource(source, 160, 120);
    const panes = [
      { x: 24, y: 20, glass: resolveGlass({ radius: 25, bezel: 22, ior: 1.33, refraction: 1.5, blur: 0, tint: 'transparent' }, 75, 72), tint: [0, 0, 0, 0] },
      { x: 58, y: 30, glass: resolveGlass({ radius: 25, bezel: 22, ior: 1.62, refraction: 1.5, blur: 0, tint: 'transparent' }, 75, 72), tint: [0, 0, 0, 0] },
    ];
    const gl = renderer.gl;
    const pixels = () => { const p = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
    const shadow = { strength: 0.2, drop: 8, blur: 4 };
    renderer.render(panes, 'fill', 1, { shadow }); const flat = pixels();
    renderer.render(panes, 'fill', 1, { layered: true, shadow }); const stack = pixels();
    let difference = 0; for (let i = 0; i < flat.length; i++) difference += Math.abs(flat[i] - stack[i]);
    const bottom = [...stack.slice(0, 4)]; const top = [...stack.slice((119 * 160) * 4, (119 * 160) * 4 + 4)];
    const noShadows = panes.map(p => ({ ...p, shadow: false }));
    renderer.render(noShadows, 'fill', 1, { layered: true, shadow }); const disabledShadows = pixels();
    renderer.render(noShadows, 'fill', 1, { layered: true }); const absentShadows = pixels();
    let shadowDifference = 0;
    for (let i = 0; i < disabledShadows.length; i++) shadowDifference += Math.abs(disabledShadows[i] - absentShadows[i]);
    // Waves: a calm field draws nothing extra, an excited one bends the image,
    // and once it sleeps the glass is exactly as before.
    const diff = (p, q) => { let d = 0; for (let i = 0; i < p.length; i++) d += Math.abs(p[i] - q[i]); return d; };
    const field = new RippleField(); field.resize(75, 72, 25);
    const rippled = panes.map((p, i) => ({ ...p, ripple: i === 0 ? field : null }));
    renderer.render(panes, 'fill', 1); const plain = pixels();
    renderer.render(rippled, 'fill', 1); const calm = pixels();
    field.drop(37, 36); for (let t = 0; t <= 96; t += 16) field.advance(t);
    renderer.render(rippled, 'fill', 1); const wavy = pixels();
    const waveError = gl.getError();
    for (let t = 112; t <= 5000; t += 16) field.advance(t);
    renderer.render(rippled, 'fill', 1); const slept = pixels();
    const asleep = !field.active;
    // A glass resized mid-life gets a fresh, smaller grid; its upload must stay in bounds.
    field.resize(60, 50, 20); field.drop(30, 25);
    for (let t = 5016; t <= 5100; t += 16) field.advance(t);
    const resizedPanes = rippled.map((p, i) => (i === 0 ? { ...p, glass: resolveGlass({ radius: 20, bezel: 18, ior: 1.33, refraction: 1.5, blur: 0, tint: 'transparent' }, 60, 50) } : p));
    renderer.render(resizedPanes, 'fill', 1); const resizedError = gl.getError();
    const waves = { calm: diff(plain, calm), wavy: diff(plain, wavy), slept: diff(plain, slept), asleep, waveError, resizedError, resizedCols: field.cols };
    // Simulation cost: a full 128 × 128 grid, 60 frames of an active surface.
    const big = new RippleField(); big.resize(320, 320, 0); big.drop(160, 160);
    const costs = []; let clock = 0; big.advance(clock);
    for (let k = 0; k < 60; k++) { const s = performance.now(); big.advance((clock += 1000 / 60)); costs.push(performance.now() - s); }
    costs.sort((x, y) => x - y);
    const simMs = costs[30];
    // Optics at rest change nothing; presence 0 removes a pane; a clipped
    // layered render keeps only its last pane.
    const REST = { presence: 1, refraction: 1, highlightX: 0, highlightY: 0, tint: 1, shadow: 1 };
    renderer.render(panes.map((p) => ({ ...p, optics: REST })), 'fill', 1); const restful = pixels();
    renderer.render([panes[0]], 'fill', 1); const onlyFirst = pixels();
    renderer.render([panes[0], { ...panes[1], optics: { ...REST, presence: 0 } }], 'fill', 1); const absent = pixels();
    renderer.render(panes, 'fill', 1, { layered: true, clip: 1, panesOnly: true }); const clipped = pixels();
    const alphaAt = (p, x, y) => p[((119 - y) * 160 + x) * 4 + 3];
    // Presence 0.5 is still fully opaque; with refraction 2 its bend is 1, so it matches rest exactly.
    renderer.render([panes[0], { ...panes[1], optics: { ...REST, presence: 0.5, refraction: 2 } }], 'fill', 1); const half = pixels();
    const opticsCheck = { rest: diff(plain, restful), half: diff(plain, half), absent: diff(onlyFirst, absent), outside: alphaAt(clipped, 4, 4), inside: alphaAt(clipped, 95, 66), clipError: gl.getError() };
    canvas.width = 240; canvas.height = 180;
    renderer.render(panes, 'fill', 1.5, { layered: true, shadow });
    const resizeError = gl.getError();
    renderer.render(panes, 'fill', 1.5); const defaultError = gl.getError();
    renderer.dispose();
    return { difference, shadowDifference, bottom, top, resizeError, defaultError, waves, simMs, opticsCheck };
  }, fileURLToPath(new URL('../../../', import.meta.url)));
  assert.equal(gpu.shadowDifference, 0, 'shadow=false must disable layered shadows');
  assert.ok(gpu.difference > 10000, JSON.stringify(gpu));
  assert.ok(gpu.bottom[2] > 240 && gpu.top[0] > 240, 'framebuffer orientation');
  assert.equal(gpu.resizeError, 0); assert.equal(gpu.defaultError, 0);
  assert.equal(gpu.waves.calm, 0, 'a calm field must not change the glass');
  assert.ok(gpu.waves.wavy > 2000, `waves must bend the image: ${JSON.stringify(gpu.waves)}`);
  assert.equal(gpu.waves.slept, 0, 'a sleeping field must leave the glass exactly as before');
  assert.ok(gpu.waves.asleep); assert.equal(gpu.waves.waveError, 0);
  assert.equal(gpu.waves.resizedError, 0, 'a resized field uploads within its layer'); assert.equal(gpu.waves.resizedCols, 24);
  assert.ok(gpu.simMs < 0.5, `ripple simulation budget: ${gpu.simMs} ms`);
  assert.equal(gpu.opticsCheck.rest, 0, 'optics at rest must not change the glass');
  assert.equal(gpu.opticsCheck.absent, 0, 'presence 0 removes a pane');
  assert.equal(gpu.opticsCheck.half, 0, 'presence fades over its lower half only');
  assert.equal(gpu.opticsCheck.outside, 0, 'a clipped render is transparent outside its pane');
  assert.ok(gpu.opticsCheck.inside > 200, `a clipped render draws its pane: ${JSON.stringify(gpu.opticsCheck)}`);
  assert.equal(gpu.opticsCheck.clipError, 0);

  const handle = page.getByRole('slider', { name: 'Navigation', exact: true });
  await handle.focus(); await page.keyboard.press('End');
  assert.equal(await handle.getAttribute('aria-valuenow'), '100');
  await page.keyboard.press('Home');
  assert.equal(await handle.getAttribute('aria-valuenow'), '0');
  await page.keyboard.press('ArrowRight');
  assert.equal(await handle.getAttribute('aria-valuenow'), '2');
  const stageBox = await page.locator('.comparison__stage').first().boundingBox();
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + 22, handleBox.y + 26); await page.mouse.down();
  await page.mouse.move(stageBox.x + stageBox.width * 0.6, handleBox.y + 26); await page.mouse.up();
  assert.ok(Number(await handle.getAttribute('aria-valuenow')) >= 59);
  if (process.env.MENISCUS_CAPTURE) await page.locator('.pattern-gallery').screenshot({ path: join(tmpdir(), 'meniscus-comparison.png') });
  await page.getByRole('button', { name: 'Try the modal' }).click();
  assert.equal(await page.locator('dialog').evaluate(el => el.open), true);
  await page.getByRole('dialog').getByRole('button', { name: 'Save plate' }).click();
  assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
  assert.match(await page.locator('.pattern-feedback').innerText(), /Plate saved/);
  await page.locator('.pattern-feedback').getByRole('button', { name: 'Dismiss', exact: true }).click();
  assert.equal(await page.locator('.pattern-feedback').innerText(), '');
  assert.equal(await page.locator('form[action="https://stackblitz.com/run"] input[name="project[files][src/App.jsx]"]').count(), 1);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await lens.scrollIntoViewIfNeeded();
  const reducedBox = await lens.boundingBox();
  await page.mouse.move(reducedBox.x + reducedBox.width / 2, reducedBox.y + reducedBox.height / 2); await page.mouse.down();
  await page.mouse.move(reducedBox.x + reducedBox.width / 2 + 30, reducedBox.y + reducedBox.height / 2 + 30, { steps: 4 }); await page.mouse.up();
  const reducedPos = await lens.evaluate(el => `${el.style.left}/${el.style.top}`);
  assert.equal(await lens.evaluate(el => el.style.transform), '', 'no squash under reduced motion');
  await page.waitForTimeout(200);
  assert.equal(await lens.evaluate(el => `${el.style.left}/${el.style.top}`), reducedPos);
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.MENISCUS_CAPTURE) await page.screenshot({ path: join(tmpdir(), 'meniscus-living-mobile.png') });
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, undefined, { timeout: 3000 });
  await page.locator('.pattern-gallery').scrollIntoViewIfNeeded();
  if (process.env.MENISCUS_CAPTURE) await page.screenshot({ path: join(tmpdir(), 'meniscus-comparison-mobile.png') });
  // Touch input on the same comparison control.
  await handle.scrollIntoViewIfNeeded();
  const touchBox = await handle.boundingBox();
  const touchStage = await page.locator('.comparison__stage').first().boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchBox.x + 22, y: touchBox.y + 26 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchStage.x + touchStage.width * 0.3, y: touchBox.y + 26 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok(Math.abs(Number(await handle.getAttribute('aria-valuenow')) - 30) < 2, 'touch comparison drag');
  await cdp.detach();
  // Context loss must show the fallback and restoration must render again.
  await depth.scrollIntoViewIfNeeded();
  await depth.evaluate(el => {
    window.__meniscusContextRecovery = el.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
    window.__meniscusContextRecovery.loseContext();
  });
  await page.waitForFunction(() => document.querySelector('.depth__stage')?.dataset.meniscusStage === 'fallback');
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.__meniscusContextRecovery.restoreContext(); delete window.__meniscusContextRecovery; });
  await page.waitForFunction(() => document.querySelector('.depth__stage')?.dataset.meniscusStage === 'ready');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', gpu, errors, checks: 'inertia, bounds, settling, keyboard, index, depth, GPU compositing/resize/orientation, scrubber, dialog, toast, reduced motion, mobile, touch, context recovery' }));
} finally { await browser.close(); }
