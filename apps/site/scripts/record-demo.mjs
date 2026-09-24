/** Record the real demo site. Run `pnpm dev --host 127.0.0.1` first. */
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';

const output = resolve(import.meta.dirname, '../../../docs/media');
const url = process.env.DEMO_URL ?? 'http://127.0.0.1:5173/';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const run = (...args) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed (${result.status})`);
};

await mkdir(output, { recursive: true });
const captureDir = await mkdtemp(join(tmpdir(), 'meniscus-video-'));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  recordVideo: { dir: captureDir, size: { width: 1440, height: 810 } },
});
const videoStarted = performance.now();
const page = await context.newPage();
const video = page.video();

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.plate-one__lens').waitFor({ state: 'visible' });
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      #meniscus-demo-caption {
        position: fixed; z-index: 10000; right: 36px; bottom: 30px;
        max-width: 520px; padding: 17px 22px;
        background: rgb(246 250 252 / 94%); color: #0f1a24;
        border: 1px solid rgb(15 26 36 / 35%); border-radius: 16px;
        box-shadow: 0 10px 35px rgb(15 26 36 / 13%);
        font: 600 20px/1.25 Arial, sans-serif; pointer-events: none;
      }
      #meniscus-demo-caption span { display: block; margin-bottom: 5px; color: #e34720; font: 700 12px/1 Arial, sans-serif; letter-spacing: .12em; text-transform: uppercase; }
    `;
    document.head.append(style);
    const caption = document.createElement('div');
    caption.id = 'meniscus-demo-caption';
    caption.innerHTML = '<span>01 / Refraction</span>Glass that bends the page';
    document.body.append(caption);
  });

  const start = performance.now();
  const at = async (seconds) => sleep(Math.max(0, start + seconds * 1000 - performance.now()));
  const caption = async (index, title, body) => page.locator('#meniscus-demo-caption').evaluate((el, data) => {
    el.innerHTML = `<span>${data.index} / ${data.title}</span>${data.body}`;
  }, { index, title, body });
  const scrollTo = async (selector) => page.locator(selector).evaluate((el) => {
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 110, behavior: 'smooth' });
  });

  await at(2);
  const lens = page.locator('.plate-one__lens');
  const box = await lens.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 150, y + 175, { steps: 75 });
  await page.mouse.move(x + 70, y + 280, { steps: 75 });
  await page.mouse.up();

  await at(9);
  await caption('02', 'Optics', 'Tune each layer of the glass');
  await scrollTo('.anatomy');
  await at(11);
  await page.getByRole('switch', { name: 'Refraction layer' }).click();
  await at(12.5);
  await page.getByRole('switch', { name: 'Refraction layer' }).click();
  await at(14);
  await page.getByRole('switch', { name: 'Aberration layer' }).click();

  await at(17);
  await caption('03', 'Interfaces', 'Real components, glass on or off');
  await scrollTo('.interfaces');
  await at(20);
  await page.getByRole('switch', { name: 'Glass', exact: true }).click();
  await at(21.5);
  await page.getByRole('switch', { name: 'Glass', exact: true }).click();
  await at(23);
  await page.getByRole('group', { name: 'Now playing' }).getByRole('button', { name: 'Play' }).click();

  await at(26);
  await caption('04', 'React', 'One component to get started');
  await scrollTo('.closing');
  await at(30);

  const preRoll = (start - videoStarted) / 1000;
  await context.close();
  await browser.close();
  const source = await video.path();
  const mp4 = join(output, 'meniscus-demo.mp4');
  const gif = join(output, 'meniscus-preview.gif');
  run('-ss', preRoll.toFixed(3), '-i', source, '-t', '30', '-vf', 'tpad=stop_mode=clone:stop_duration=1', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4);
  run('-ss', '2', '-t', '4', '-i', mp4, '-vf', 'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', gif);
  await rm(captureDir, { recursive: true, force: true });
  console.log(`Wrote ${mp4} and ${gif}`);
} catch (error) {
  await context.close();
  await browser.close();
  await rm(captureDir, { recursive: true, force: true });
  throw error;
}
