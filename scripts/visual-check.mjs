import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const controls = process.argv.includes('--controls');
const fixedMap = process.argv.includes('--fixed-map');
const output = fixedMap ? 'docs/validation-images/fixed-map' : controls ? 'docs/validation-images/controls-playback' : 'docs/validation-images/observatory';
mkdirSync(output, { recursive: true });
const panelsOnly = process.argv.includes('--panels-only');
const results = [], errors = [];
async function ready(page) {
  await expect(page.getByText('正在准备地图…')).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByRole('button', { name: '开始播放', exact: true })).toBeEnabled({ timeout: 30000 });
}
async function datePanel(page) {
  const button = page.getByRole('button', { name: '日期与节气', exact: true });
  if (await button.isVisible() && !await page.getByRole('dialog').isVisible()) await button.click();
}
async function closePanel(page) {
  const button = page.getByRole('button', { name: '关闭面板', exact: true });
  if (await button.isVisible()) await button.click();
}
async function shot(page, name) {
  // Wait for finite presentation transitions, not arbitrary network delays.
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    mobilePresentation: document.querySelector('.atlas-app').classList.contains('mobile-presentation'),
    maps: [...document.querySelectorAll('.map-canvas')].map(e => ({ width: e.clientWidth, height: e.clientHeight })),
    seasonGroups: document.querySelectorAll('.season').length,
    dialogOpen: !!document.querySelector('dialog[open]'),
    islandLabels: [...document.querySelectorAll('.map-pane')].map(e => e.__vueParentComponent.exposed.getInsetLabels()),
  }));
  if (fixedMap && !metrics.mobilePresentation && !['loading','resource-error'].includes(name)) for (const labels of metrics.islandLabels) {
    for (const label of ['东沙群岛','西沙群岛','中沙群岛','南沙群岛','黄岩岛','曾母暗沙'])
      if (!labels.includes(label)) throw new Error(`Missing inset label: ${name} ${label}`);
  }
  if (metrics.overflow) throw new Error(`Horizontal overflow: ${name}`);
  results.push({ name, ...metrics });
}
async function term(page, name) {
  await datePanel(page);
  await page.locator('.term-button').filter({ hasText: name }).click();
  await expect(page.getByRole('button', { name: '暂停播放', exact: true })).toBeVisible();
}
async function pause(page) { await page.getByRole('button', { name: '暂停播放', exact: true }).click(); }
async function seekMinute(page, minute) { await page.getByRole('slider',{name:'北京时间时间轴'}).fill(String(minute)); }
async function clickMap(page, point) {
  // Let ResizeObserver refit the shared camera after a layout switch before projecting.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect.poll(() => page.locator('.map-pane').first().evaluate(e => e.__vueParentComponent.exposed.isLoaded())).toBe(true);
  const projected = await page.locator('.map-pane').first().evaluate((e, point) => e.__vueParentComponent.exposed.projectPoint(point), point);
  await page.locator('.map-canvas').first().click({ position: { x: projected.x, y: projected.y } });
  await expect(page.locator('.detail-loading')).toHaveCount(0, { timeout: 30000 });
}
let chrome, safari;
try {
  chrome = await chromium.launch();
  const sizes = [
    ['mobile-360', 360, 800], ['mobile-390', 390, 844], ['tablet', 768, 1024],
    ['landscape', 844, 390], ['laptop', 1280, 720], ['narrow-dual', 1360, 900], ['desktop', 1440, 900], ['wide', 1920, 1080],
  ];
  for (const [name, width, height] of sizes) {
    const page = await chrome.newPage({ viewport: { width, height } });
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await page.goto('http://127.0.0.1:5173'); await ready(page);
    await shot(page, `${name}-single`);
    await datePanel(page); await shot(page, `${name}-calendar`);
    if (controls) {
      await page.getByRole('button',{name:'日期 1',exact:true}).click();
      await expect(page.getByRole('dialog',{name:'选择观测日期',exact:true})).toBeVisible();
      await expect.poll(async () => {
        const box=await page.getByRole('dialog',{name:'选择观测日期',exact:true}).boundingBox();
        return !!box && box.x>=0 && box.y>=0 && box.x+box.width<=width && box.y+box.height<=height;
      }, { message: `Calendar outside viewport: ${name}` }).toBe(true);
      await shot(page, `${name}-date-picker`); await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: '两天对比', exact: true }).click(); await closePanel(page); await ready(page);
    await shot(page, `${name}-compare`);
    await datePanel(page); await page.getByRole('button', { name: '退出对比', exact: true }).click(); await closePanel(page);
    await clickMap(page, [112.933419, 28.23129]);
    const details = page.getByRole('button', { name: '地区详情', exact: true });
    if (await details.isVisible() && !await page.locator('.mobile-dialog').isVisible()) await details.click();
    await expect(page.getByRole('heading', { name: '湖南省', exact: true })).toBeVisible();
    await shot(page, `${name}-details`);
    await page.close();
  }
  safari = await webkit.launch();
  const mobile = await safari.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  mobile.on('pageerror', e => errors.push(`webkit: ${e.message}`));
  await mobile.goto('http://127.0.0.1:5173'); await ready(mobile);
  await datePanel(mobile); await shot(mobile, 'webkit-calendar'); await term(mobile, '夏至'); await pause(mobile); await shot(mobile, 'webkit-night');
  if (!panelsOnly) {
    const page = await chrome.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(`scenes: ${e.message}`));
    await page.goto('http://127.0.0.1:5173'); await ready(page);
    await term(page, '夏至'); await pause(page); await shot(page, 'national-night');
    await seekMinute(page, 360); await shot(page, 'national-dawn');
    await seekMinute(page, 720); await shot(page, 'national-noon');
    await page.getByRole('button', { name: '两天对比', exact: true }).click(); await ready(page);
    await page.getByRole('button', { name: '节气应用于日期 2', exact: true }).click(); await term(page, '冬至'); await pause(page); await seekMinute(page, 360); await shot(page, 'compare-seasons');
    await page.close();
  }
  const loading = await chrome.newPage({ viewport: { width: 1440, height: 900 } });
  await loading.addInitScript(()=>{
    const frame=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
    const held=new Map();let blocked=true,next=-1;
    window.requestAnimationFrame=callback=>{if(!blocked)return frame(callback);const id=next--;held.set(id,callback);return id;};
    window.cancelAnimationFrame=id=>{if(id<0)held.delete(id);else cancel(id);};
    window.__resumeRendering=()=>{blocked=false;for(const callback of held.values())frame(callback);held.clear();};
  });
  await loading.goto('http://127.0.0.1:5173'); await expect(loading.getByText('正在准备地图…')).toBeVisible();
  await shot(loading, 'loading'); await loading.evaluate(()=>window.__resumeRendering()); await ready(loading); await loading.close();
  const failed = await chrome.newPage({ viewport: { width: 360, height: 800 } });
  await failed.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;return original.call(this,type,...args);};
  });
  await failed.goto('http://127.0.0.1:5173');
  await expect(failed.locator('.map-error')).toBeVisible(); await shot(failed, 'resource-error'); await failed.close();
  if (errors.length) throw new Error(errors.join('\n'));
  writeFileSync(`${output}/visual-check.json`, JSON.stringify({ checkedAt: new Date().toISOString(), results, errors }, null, 2));
  if (controls) writeFileSync(`${output}/index.html`, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${fixedMap ? "固定总览与彩色昼夜截图" : "日期、节气与播放控制截图"}</title><style>body{margin:24px;background:#f4f8fa;color:#173441;font:16px system-ui}h1{font-size:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}figure{margin:0;padding:12px;background:white;border-radius:12px}img{width:100%;height:340px;object-fit:contain}figcaption{margin-top:12px}a{color:inherit}</style><h1>${fixedMap ? "固定总览与彩色昼夜截图" : "日期、节气与播放控制截图"}</h1><p>点击图片查看原图。共 ${results.length} 张，浏览器尺寸与触控模拟。</p><main>${results.map(({name})=>`<figure><a href="${name}.png"><img loading="lazy" src="${name}.png" alt="${name}"></a><figcaption>${name}</figcaption></figure>`).join('')}</main></html>`);
  console.log(JSON.stringify({ screenshots: results.length, errors }));
} finally { await chrome?.close(); await safari?.close(); }
