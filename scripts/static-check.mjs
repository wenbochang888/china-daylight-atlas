import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

// Verify the complete production directory under a static subdirectory.
const root = resolve('dist');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.mp3':'audio/mpeg' };
const audioCheck = process.argv.includes('--audio') || process.argv.includes('--audio-timeline');
const outputDirectory = process.argv.includes('--audio-timeline') ? 'docs/validation-images/audio-timeline' : process.argv.includes('--fixed-map') ? 'docs/validation-images/fixed-map' : audioCheck ? 'docs/validation-images/playback-audio' : process.argv.includes('--controls') ? 'docs/validation-images/controls-playback' : 'docs/validation-images/observatory';
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/atlas/')) throw new Error('Outside the static mount');
    const path = resolve(root, pathname.slice('/atlas/'.length) || 'index.html');
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('Not found');
    response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});
await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch();
  const results = [], failures = [];
  const url = 'http://127.0.0.1:4174/atlas/';
  for (const viewport of [{width:1440,height:900},{width:768,height:1024},{width:844,height:390}]) {
    const context = await browser.newContext({ viewport, timezoneId:'America/New_York' });
    const page = await context.newPage();
    const external = [];
    page.on('request', request => {
      const requestUrl=request.url();
      if (!requestUrl.startsWith('http://127.0.0.1:4174/') && !requestUrl.startsWith('blob:http://127.0.0.1:4174/')) external.push(requestUrl);
    });
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    await page.goto(url);
    await page.getByText('正在加载官方地图').waitFor({state:'hidden'});
    const mobile=page.getByRole('button',{name:'日期与节气',exact:true});
    if(await mobile.isVisible())await mobile.click();
    const date = await page.getByRole('button',{name:'日期 1',exact:true}).getAttribute('data-date');
    const expectedDate = await page.evaluate(() => new Date(Date.now()+8*3600000).toISOString().slice(0,10));
    if(date!==expectedDate) throw new Error('Device timezone changed the Beijing date');
    await page.getByRole('button',{name:'两天对比',exact:true}).click();
    const close=page.getByRole('button',{name:'关闭面板'});
    if(await close.isVisible())await close.click();
    await page.getByText('正在加载官方地图').waitFor({state:'hidden'});
    if(await mobile.isVisible())await mobile.click();
    await page.locator('.term-button').filter({hasText:'夏至'}).click();
    let music;
    if (audioCheck) {
      const audio = page.locator('audio');
      await expect(audio).toHaveCount(1);
      await expect.poll(async () => await audio.evaluate(element => !element.paused && element.currentTime > 0.15) || await page.locator('.audio-notice').isVisible()).toBe(true);
      if (await page.locator('.audio-notice').isVisible()) await page.getByRole('button',{name:'重试音乐',exact:true}).click();
      await expect.poll(() => audio.evaluate(element => !element.paused && element.currentTime > 0.15)).toBe(true);
      music = await audio.evaluate(element => ({ source:element.currentSrc, duration:element.duration, loop:element.loop, rate:element.playbackRate }));
      const response = await page.request.head(music.source);
      if (!music.source.startsWith(url+'assets/') || !response.ok() || response.headers()['content-type'] !== 'audio/mpeg' || !music.loop || music.rate !== 1 || Math.abs(music.duration-265) > 1)
        throw new Error(JSON.stringify({music,status:response.status(),headers:response.headers()}));
    }
    await page.getByRole('button',{name:'暂停播放',exact:true}).click();
    if (audioCheck && !await page.locator('audio').evaluate(element => element.paused)) throw new Error('Music continued after pausing');
    const time=await page.getByTestId('clock').innerText();
    const view = await page.evaluate(() => ({
      overflow:document.documentElement.scrollWidth>window.innerWidth,
      canvases:[...document.querySelectorAll('.map-canvas')].map(element=>({width:element.clientWidth,height:element.clientHeight})),
    }));
    const errors = await page.locator('.map-error').allTextContents();
    if(view.overflow || errors.length || external.length || view.canvases.length!==2 || view.canvases.some(canvas=>canvas.width<=0||canvas.height<=0))
      throw new Error(JSON.stringify({viewport,view,errors,external}));
    if (audioCheck) {
      mkdirSync(outputDirectory,{recursive:true});
      await page.screenshot({path:`${outputDirectory}/static-${viewport.width}.png`,fullPage:true});
    }
    results.push({viewport,deviceTimezone:'America/New_York',date,time,...view,externalRequests:external.length,...(music ? {music} : {})});
    await context.close();
  }
  if(failures.length) throw new Error(failures.join('\n'));
  const result={url,results,failures};
  writeFileSync(`${outputDirectory}/static-production.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
