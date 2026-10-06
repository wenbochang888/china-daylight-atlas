import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

// Targeted production checks for the four observation features, not a full regression.
const root = resolve('dist'), output = 'docs/validation-images/observation-explore';
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg'};
const server = createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if (!pathname.startsWith('/atlas/')) throw new Error('outside mount');
    const file = resolve(root,pathname.slice('/atlas/'.length)||'index.html');
    if (!file.startsWith(root+sep) || !(await stat(file)).isFile()) throw new Error('not found');
    response.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'}); response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(4174,'127.0.0.1',resolve));
let browser;
try {
  await mkdir(output,{recursive:true}); browser = await chromium.launch();
  const results = [];
  for (const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:360,height:800}]]) {
    const context = await browser.newContext({viewport,timezoneId:'America/New_York',isMobile:name==='mobile',hasTouch:name==='mobile'});
    const page = await context.newPage(), failures = [];
    page.on('pageerror',error=>failures.push(error.message));
    page.on('response',response=>{if(response.status()>=400)failures.push(`${response.status()} ${response.url()}`);});
    await page.clock.setFixedTime(new Date('2026-10-06T04:34:00Z'));
    await page.goto('http://127.0.0.1:4174/atlas/');
    const ready = () => expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});
    await ready(); await expect(page.getByTestId('clock')).toHaveText('00:00');
    await page.getByRole('button',{name:'冬夏对比',exact:true}).click(); await ready();
    await expect(page.getByTestId('map-clock')).toHaveText(['07:00','07:00']);
    await expect(page.locator('.map-day')).toHaveText(['2026.06.21（夏至）','2026.12.22（冬至）']);
    await page.screenshot({path:`${output}/production-${name}-solstices.png`,fullPage:true});
    await page.getByRole('button',{name:'分享',exact:true}).click();
    const share = page.getByRole('dialog',{name:'分享当前观测',exact:true});
    const url = await share.getByRole('textbox',{name:'场景链接'}).inputValue();
    if (new URL(url).pathname !== '/atlas/') throw new Error('Shared link lost deployment subdirectory');
    await page.keyboard.press('Escape'); await page.goto(url);
    await expect.poll(()=>new URL(page.url()).hash).toBe(''); await ready();
    await expect(page.getByTestId('map-clock')).toHaveText(['07:00','07:00']);
    await page.getByRole('button',{name:'看此刻',exact:true}).click(); await ready();
    await expect(page.getByTestId('clock')).toHaveText('12:34');
    if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('Horizontal overflow');
    await expect(page.locator('audio')).toHaveCount(1); await expect(page.locator('audio')).toHaveJSProperty('paused',true);
    expect(failures).toEqual([]);
    results.push({name,viewport,sharedUrl:url,errors:failures,passed:true}); await context.close();
  }
  await writeFile(`${output}/production.json`,JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
  console.log(JSON.stringify(results));
} finally {
  await browser?.close(); await new Promise(resolve=>server.close(resolve));
}
