import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';

const argument = (name, fallback) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const root = resolve(argument('root', 'dist')), label = argument('label', 'optimized');
const output = argument('output', `docs/validation-images/startup-music/${label}.json`);
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.mp3':'audio/mpeg' };
const files = new Map();
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/atlas/')) throw new Error('Outside static mount');
    const file = resolve(root, pathname.slice('/atlas/'.length) || 'index.html');
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw new Error('Not found');
    let body = files.get(file);
    if (!body) { body = await readFile(file); files.set(file, body); }
    const etag = `"${body.length}-${(await stat(file)).mtimeMs}"`;
    const headers = { 'Content-Type':mime[extname(file)] ?? 'application/octet-stream',
      'Cache-Control':pathname.startsWith('/atlas/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', ETag:etag };
    if (request.headers['if-none-match'] === etag) { response.writeHead(304, headers); response.end(); return; }
    if (/\.(js|css|json|html)$/.test(file) && request.headers['accept-encoding']?.includes('gzip')) {
      headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; body = gzipSync(body);
    }
    response.writeHead(200, headers); response.end(body);
  } catch { response.writeHead(404); response.end('Not found'); }
});
let browser;
try {
  await new Promise((yes, no) => { server.once('error', no); server.listen(4175, '127.0.0.1', yes); });
  browser = await chromium.launch();
  const samples = [];
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({ viewport:{width:1440,height:1000}, timezoneId:'America/New_York' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const result = { mapVisibleMs:0, playbackReadyMs:0 };
      window.__startup = result;
      const observer = new MutationObserver(() => {
        if (!result.mapVisibleMs && document.querySelector('.map-time')) result.mapVisibleMs = performance.now();
        const play = document.querySelector('button[aria-label="开始播放"]');
        if (!result.playbackReadyMs && play && !play.disabled) result.playbackReadyMs = performance.now();
        if (result.mapVisibleMs && result.playbackReadyMs) observer.disconnect();
      });
      observer.observe(document, { childList:true, subtree:true, attributes:true, attributeFilter:['disabled'] });
    });
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', { offline:false, latency:60, downloadThroughput:10*1024*1024/8, uploadThroughput:1024*1024/8 });
    await session.send('Emulation.setCPUThrottlingRate', { rate:4 });
    for (const cache of ['cold','warm']) {
      await page.goto('http://127.0.0.1:4175/atlas/');
      await expect(page.getByRole('button', {name:'开始播放',exact:true})).toBeEnabled({timeout:30000});
      await expect(page.locator('.map-time')).toHaveCount(1);
      await expect(page.getByRole('button', {name:'日期 1',exact:true})).toBeVisible();
      const sample = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource').filter(entry => !entry.name.startsWith('blob:')).map(entry => ({
          path:new URL(entry.name).pathname, transferBytes:entry.transferSize, decodedBytes:entry.decodedBodySize,
        }));
        const navigation = performance.getEntriesByType('navigation')[0];
        return { ...window.__startup, resources, transferBytes:resources.reduce((sum, entry) => sum + entry.transferBytes, navigation.transferSize) };
      });
      samples.push({run,cache,...sample});
      if (run === 3 && cache === 'warm') await page.screenshot({path:output.replace(/\.json$/, '.png'),fullPage:true});
    }
    if (errors.length) throw new Error(errors.join('\n'));
    await context.close();
  }
  const median = values => values.sort((a,b) => a-b)[Math.floor(values.length/2)];
  const summary = Object.fromEntries(['cold','warm'].map(cache => [cache, Object.fromEntries(['mapVisibleMs','playbackReadyMs','transferBytes'].map(key => [key, Math.round(median(samples.filter(s => s.cache === cache).map(s => s[key])))]))]));
  mkdirSync(dirname(output), {recursive:true});
  writeFileSync(output, JSON.stringify({label,checkedAt:new Date().toISOString(),environment:'Chromium headless; 1440x1000; 10 Mbps / 60 ms latency / 4x CPU slowdown; gzip; hashed assets immutable; HTML and JSON no-cache',summary,samples},null,2));
  console.log(JSON.stringify({label,summary}));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
