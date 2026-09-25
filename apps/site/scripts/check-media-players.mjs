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

    const video = page.locator('.media-video video');
    const audio = page.locator('.media-music audio');
    await video.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.media-video video')?.readyState >= 1);
    await page.waitForFunction(() => document.querySelector('.media-music audio')?.readyState >= 1);
    assert.ok(await video.evaluate((el) => el.duration >= 19.9 && el.currentSrc.includes('/media/opticks-film.mp4')), 'the film is the plates, not the site');
    assert.ok(await audio.evaluate((el) => el.duration >= 19.9));

    await page.locator('.media-showcase__figure--video').screenshot({ path: `/private/tmp/meniscus-video-${width}.png` });
    await page.locator('.media-showcase__figure--music').screenshot({ path: `/private/tmp/meniscus-music-${width}.png` });

    await page.locator('.media-video__hero-play').click();
    await page.waitForFunction(() => !document.querySelector('.media-video video')?.paused);
    await page.waitForTimeout(250);
    assert.ok(await video.evaluate((el) => el.currentTime > 0));
    await page.getByRole('button', { name: 'Pause video' }).click();
    assert.ok(await video.evaluate((el) => el.paused));
    await page.getByRole('button', { name: 'Mute video' }).click();
    assert.ok(await video.evaluate((el) => el.muted));
    await page.getByRole('button', { name: 'Unmute video' }).click();
    assert.ok(!(await video.evaluate((el) => el.muted)));
    const videoSeek = page.getByRole('slider', { name: 'Video position' });
    const seekBox = await videoSeek.boundingBox();
    await page.mouse.click(seekBox.x + seekBox.width * 0.6, seekBox.y + seekBox.height / 2);
    assert.ok(await video.evaluate((el) => el.currentTime > 10));
    const level = await page.locator('.media-video .media-seek__visual').evaluate((el) => parseFloat(el.style.getPropertyValue('--seek')));
    const actual = await video.evaluate((el) => el.currentTime / el.duration * 100);
    assert.ok(Math.abs(level - actual) < 1, 'the scale responds immediately to seeking');
    const lens = await page.locator('.media-video .media-seek__lens').boundingBox();
    const scale = await page.locator('.media-video .media-seek__scale').boundingBox();
    assert.ok(Math.abs(lens.x + lens.width / 2 - (scale.x + scale.width * actual / 100)) < 2, 'the glass lens rides the playhead');
    await page.mouse.move(seekBox.x + seekBox.width * 0.4, seekBox.y + seekBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(seekBox.x + seekBox.width * 0.7, seekBox.y + seekBox.height / 2, { steps: 4 });
    const preview = page.locator('.media-video .media-seek__preview');
    await preview.waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('.media-video video').seeking);
    assert.ok(await preview.locator('canvas').evaluate(el => el.getContext('2d').getImageData(80, 45, 1, 1).data[3] > 0), 'preview contains a decoded frame');
    await page.locator('.media-showcase__figure--video').screenshot({ path: `/private/tmp/meniscus-scrub-${width}.png` });
    await page.mouse.up();
    await preview.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Fullscreen video' }).click();
    await page.waitForFunction(() => document.fullscreenElement?.classList.contains('media-video'));
    await page.getByRole('button', { name: 'Fullscreen video' }).click();
    await page.waitForFunction(() => !document.fullscreenElement);

    await page.getByRole('button', { name: 'Play music' }).click();
    await page.waitForFunction(() => !document.querySelector('.media-music audio')?.paused);
    await page.waitForTimeout(250);
    assert.ok(await audio.evaluate((el) => el.currentTime > 0));
    const before = await audio.evaluate((el) => el.currentTime);
    await page.getByRole('button', { name: 'Forward 5 seconds' }).click();
    assert.ok((await audio.evaluate((el) => el.currentTime)) >= before + 4.9);
    await page.getByRole('button', { name: 'Pause music' }).click();
    assert.ok(await audio.evaluate((el) => el.paused));
    const musicSeek = page.getByRole('slider', { name: 'Music position' });
    await musicSeek.focus();
    await page.keyboard.press('End');
    assert.equal(await page.locator('.media-music .media-seek__visual').evaluate(el => el.style.getPropertyValue('--seek')), '100%');
    await page.keyboard.press('Home');
    assert.equal(await page.locator('.media-music .media-seek__visual').evaluate(el => el.style.getPropertyValue('--seek')), '0%');
    await page.getByRole('button', { name: 'Forward 5 seconds' }).click();
    await page.locator('.media-showcase__figure--video').screenshot({ path: `/private/tmp/meniscus-video-${width}.png` });
    await page.locator('.media-showcase__figure--music').screenshot({ path: `/private/tmp/meniscus-music-${width}.png` });

    const overflow = await page.locator('#demos').evaluate((el) => el.getBoundingClientRect().right - innerWidth);
    assert.ok(overflow <= 1, `media plate overflows the viewport by ${overflow}px at ${width}px`);
    await page.locator('.media-video__hero-play').click();
    await page.waitForFunction(() => !document.querySelector('.media-video video')?.paused);
    await page.getByRole('button', { name: 'Switch to lantern slide (dark)' }).click();
    // The lantern film replaces the print one; the player must not think it is still playing.
    await page.waitForFunction(() => document.querySelector('.media-video video')?.currentSrc.includes('opticks-film-lantern'));
    await page.getByRole('button', { name: 'Play video' }).waitFor();
    await page.locator('.media-showcase__figure--video').screenshot({ path: `/private/tmp/meniscus-video-lantern-${width}.png` });
    await page.locator('.media-showcase__figure--music').screenshot({ path: `/private/tmp/meniscus-music-lantern-${width}.png` });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Media players: desktop and mobile layout, loading, playback, seek, pause, and console checks passed.');
} finally {
  await browser.close();
}
