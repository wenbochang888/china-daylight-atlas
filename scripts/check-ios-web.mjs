import { webkit, expect, devices } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

// Package-only HTTP mount approximates bundled resource availability. It does
// not replace offline launch or media interruption tests on a physical iPhone.
const root = resolve(process.argv.includes('--website') ? 'dist' : 'dist-ios');
const comparisonCheck = process.argv.includes('--comparison-alignment');
const output = resolve(comparisonCheck ? 'docs/validation-images/comparison-alignment' : 'docs/validation-images/ios-app');
await mkdir(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/atlas/')) throw new Error('outside mount');
    const file = resolve(root, pathname.slice(7) || 'index.html');
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw new Error('missing file');
    const data = await readFile(file), headers = { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? '');
    if (range) {
      const start = Number(range[1]), end = Math.min(data.length - 1, range[2] ? Number(range[2]) : data.length - 1);
      if (start > end) { response.writeHead(416, { 'Content-Range': `bytes */${data.length}` });response.end();return; }
      response.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });response.end(data.subarray(start, end + 1));
    } else { response.writeHead(200, { ...headers, 'Content-Length': data.length });response.end(data); }
  } catch { response.writeHead(404);response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser, page;
const errors = [], failed = [], requests = [], messages = [];
try {
  browser = await webkit.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'America/New_York' });
  page = await context.newPage();
  if (comparisonCheck) await page.clock.setFixedTime(new Date('2026-10-05T04:00:00Z'));
  page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  page.on('request', request => requests.push(request.url()));
  await context.route('**/*', route => {
    const url = route.request().url();
    return url.startsWith(origin + '/atlas/') || url.startsWith('blob:' + origin + '/') ? route.continue() : route.abort();
  });
  await page.goto(origin + '/atlas/');
  if (!process.argv.includes('--website')) {
    const licenses = await page.request.get(origin + '/atlas/licenses.txt');
    expect(licenses.ok()).toBe(true);expect(await licenses.text()).toContain('wenbochang888');
  }
  const play = page.getByRole('button', { name: '开始播放', exact: true });
  await expect(play).toBeEnabled({ timeout: 30000 });await expect(page.getByTestId('clock')).toHaveText('00:00');
  const today = await page.evaluate(() => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10).replaceAll('-', '.'));
  await expect(page.locator('.map-day')).toHaveText(today);
  await page.getByRole('button', { name: '日期与节气', exact: true }).click();
  await page.getByRole('button', { name: '日期 1', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '选择观测日期', exact: true })).toBeVisible();await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '两天对比', exact: true }).click();
  await page.getByRole('button', { name: '关闭面板', exact: true }).click();await expect(play).toBeEnabled({ timeout: 30000 });
  await expect(page.locator('.map-canvas canvas')).toHaveCount(2);await expect(page.locator('.inset-canvas canvas')).toHaveCount(0);
  await page.getByRole('slider', { name: '北京时间时间轴' }).fill('1440');
  await expect(page.getByTestId('map-clock')).toHaveText(['24:00', '24:00']);
  await expect(page.locator('.map-day').first()).toHaveText(today);
  await page.getByRole('slider', { name: '北京时间时间轴' }).fill('360');await play.click();
  await expect.poll(() => page.locator('audio').evaluate(audio => ({ paused: audio.paused, duration: audio.duration, ready: audio.readyState }))).toMatchObject({ paused: false, ready: 4 });
  await expect.poll(() => page.locator('audio').evaluate(audio => Number.isFinite(audio.duration))).toBe(true);
  await page.getByRole('button', { name: '暂停播放', exact: true }).click();
  const media = await page.locator('audio').evaluate(audio => ({ src: audio.currentSrc, paused: audio.paused, loop: audio.loop, rate: audio.playbackRate, duration: audio.duration }));
  expect(media.paused).toBe(true);expect(media.loop).toBe(true);expect(media.rate).toBe(1);expect(media.duration).toBeGreaterThan(260);expect(media.duration).toBeLessThan(270);
  if (comparisonCheck) {
    for (const [index,name] of [[1,'夏至'],[2,'冬至']]) {
      await page.getByRole('button', { name: '日期与节气', exact: true }).click();
      await page.getByRole('button', { name: `节气应用于日期 ${index}`, exact: true }).click();
      await page.locator('.term-button').filter({ hasText: name }).click();
      // Selecting a term closes the phone panel and starts playback.
      await expect(page.getByRole('button', { name: '暂停播放', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '暂停播放', exact: true }).click();
    }
    await page.getByRole('slider', { name: '北京时间时间轴' }).fill('202');
    await expect(page.locator('.map-day')).toHaveText(['2026.06.21（夏至）','2026.12.22（冬至）']);
    for (const term of await page.getByTestId('map-solar-term').all()) expect(await term.evaluate(element => {
      const style = getComputedStyle(element), dateStyle = getComputedStyle(element.parentElement);
      return style.display === 'inline' && style.fontSize === dateStyle.fontSize && style.borderTopWidth === '0px';
    })).toBe(true);
  }
  const canvas = await page.locator('.map-canvas canvas').first().elementHandle();
  await page.getByRole('button', { name: '全屏查看地图', exact: true }).click();await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeVisible();
  let alignmentResults;
  if (comparisonCheck) {
    const geometry = () => page.locator('.map-pane').evaluateAll(panes => panes.map(pane => {
      const canvas = pane.querySelector('.map-canvas canvas'), bounds = canvas.getBoundingClientRect();
      const card = pane.querySelector('.map-info').getBoundingClientRect(), style = getComputedStyle(pane);
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl || gl.isContextLost()) throw new Error('Cannot read rendered map');
      const pixels = new Uint8Array(canvas.width*canvas.height*4), framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
      let top=Infinity,bottom=-Infinity,left=Infinity,right=-Infinity;
      let outlineLeft=Infinity,outlineRight=-Infinity,outlineTop=Infinity,outlineBottom=-Infinity;
      // Province boundaries and label ink are drawn after the solar layer and keep their fixed colours.
      for (let offset=0;offset<pixels.length;offset+=4) {
        const boundary=pixels[offset]===49&&pixels[offset+1]===94&&pixels[offset+2]===104;
        const label=pixels[offset]===23&&pixels[offset+1]===60&&pixels[offset+2]===89;
        if (!boundary&&!label) continue;
        const pixel=offset/4,x=(pixel%canvas.width)*bounds.width/canvas.width,y=bounds.height-(Math.floor(pixel/canvas.width)+1)*bounds.height/canvas.height;
        top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);
        if (boundary) { outlineLeft=Math.min(outlineLeft,x);outlineRight=Math.max(outlineRight,x);outlineTop=Math.min(outlineTop,y);outlineBottom=Math.max(outlineBottom,y); }
      }
      return { scene:{top:Math.min(top,card.top-bounds.top),bottom:Math.max(bottom,card.bottom-bounds.top)},
        cardBottom:card.bottom-bounds.top,
        outline:{left:outlineLeft,right:outlineRight,top:outlineTop,bottom:outlineBottom},height:bounds.height,
        topInset:parseFloat(style.paddingTop)||0,bottomInset:parseFloat(style.paddingBottom)||0,alignment:pane.dataset.comparisonAlign };
    }));
    const check = async () => {
      let previous = '', stable = 0;
      await expect.poll(async () => {
        const current = await geometry(), key = JSON.stringify(current);
        stable = key===previous ? stable+1 : 0;previous = key;
        const [first,second] = current;
        const gap=first.height-first.scene.bottom;
        return stable>=3&&Number.isFinite(gap)&&gap>=10&&gap<=25&&Math.abs(second.scene.top-12)<1;
      },{timeout:10000,intervals:[50,100,200]}).toBe(true);
      const [first,second] = await geometry();
      expect(first.alignment).toBe('bottom');expect(second.alignment).toBe('top');
      expect(Math.abs((first.outline.right-first.outline.left)-(second.outline.right-second.outline.left))).toBeLessThan(2);
      expect(Math.abs((first.outline.bottom-first.outline.top)-(second.outline.bottom-second.outline.top))).toBeLessThan(2);
      expect(first.outline.top-first.cardBottom).toBeGreaterThanOrEqual(10);
      expect(second.outline.top-second.cardBottom).toBeGreaterThanOrEqual(10);
      expect(first.scene.top).toBeGreaterThanOrEqual(first.topInset);
      expect(second.scene.bottom).toBeLessThanOrEqual(second.height-second.bottomInset);
      return [first,second];
    };
    const prefix = process.argv.includes('--website') ? 'website' : 'package';
    alignmentResults = { portrait: await check() };
    await page.screenshot({path:resolve(output,`${prefix}-portrait.png`)});
    // Simulate an iPhone safe area; this is browser verification, not a physical screen capture.
    const safeStyle = await page.addStyleTag({content:'.immersive-pane[data-comparison-align="bottom"]{padding-top:59px}.immersive-pane[data-comparison-align="top"]{padding-bottom:34px}.immersive .map-view-controls{top:71px}'});
    await page.setViewportSize({width:390,height:845});
    alignmentResults.simulatedSafeArea = await check();
    await page.screenshot({path:resolve(output,`${prefix}-simulated-safe-area.png`)});
    await safeStyle.evaluate(element=>element.remove());
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('.inset-canvas canvas')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: resolve(output, process.argv.includes('--website') ? 'website-subdirectory-webkit.png' : 'package-webkit-landscape.png') });
  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  expect(await canvas.evaluate(element => element === document.querySelector('.map-canvas canvas'))).toBe(true);
  await expect(play).toBeEnabled();await page.reload();await expect(play).toBeEnabled({ timeout: 30000 });await expect(page.getByTestId('clock')).toHaveText('00:00');
  expect(errors).toEqual([]);expect(failed).toEqual([]);expect(requests.filter(url => url.includes('/maps/'))).toEqual([]);
  const result = { resourceRoot: root, browser: 'Playwright WebKit, iPhone 13 viewport', deviceTimezone: 'America/New_York', packageOnly: true, checks: ['today 00:00 paused', 'lazy calendar', 'dual maps', '24:00 civil day', 'real MP3 decode and pause', 'landscape fullscreen', 'same map instance', 'reload 00:00', 'no maps JSON or remote requests', ...(comparisonCheck ? ['inline terms', 'portrait alignment by rendered pixels', 'simulated safe area', 'equal rendered outline scale'] : [])], alignmentResults, media, errors, failed };
  await writeFile(resolve(output, process.argv.includes('--website') ? 'website-subdirectory.json' : 'package-webkit.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'package-check-failure.png') });
  console.error(JSON.stringify({ errors, failed, requests, messages, ui: await page?.locator('body').innerText() }, null, 2));
  throw error;
} finally { await browser?.close();await new Promise(resolve => server.close(resolve)); }
