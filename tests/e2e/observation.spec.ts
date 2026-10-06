import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const fixedNow = new Date('2026-10-06T04:34:00Z');
test.beforeEach(async ({page}) => { await page.clock.setFixedTime(fixedNow); });
async function ready(page: Page) { await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000}); }
async function screenshot(page: Page, name: string) {
  await mkdir('docs/validation-images/observation-explore',{recursive:true});
  await page.screenshot({path:`docs/validation-images/observation-explore/${name}.png`,fullPage:true});
}
test('三个场景保持暂停，时间编辑校验24点及取消焦点', async ({page},info) => {
  await page.goto('/'); await ready(page);
  await page.getByRole('button',{name:'看晨光',exact:true}).click();
  await expect(page.getByRole('button',{name:'看晨光',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('clock')).not.toHaveText('00:00');
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'冬夏对比',exact:true}).click(); await ready(page);
  await expect(page.locator('.map-day')).toHaveText(['2026.06.21（夏至）','2026.12.22（冬至）']);
  await expect(page.getByTestId('map-clock')).toHaveText(['07:00','07:00']);
  // Dispatch in one task so older preparation timers cannot commit an intermediate scene.
  await page.locator('.explore-toolbar').evaluate(toolbar => {
    for (const name of ['看晨光','冬夏对比','看此刻']) {
      [...toolbar.querySelectorAll('button')].find(button=>button.textContent===name)?.click();
    }
  }); await ready(page);
  await expect(page.locator('.map-day')).toHaveText('2026.10.06'); await expect(page.getByTestId('clock')).toHaveText('12:34');
  await expect(page.getByRole('button',{name:'看此刻',exact:true})).toHaveAttribute('aria-pressed','true');
  const editor = page.getByRole('button',{name:'设置北京时间',exact:true}); await editor.click();
  const setting = page.getByRole('dialog',{name:'设置北京时间',exact:true});
  await setting.getByRole('textbox',{name:'小时',exact:true}).fill('24');
  await setting.getByRole('textbox',{name:'分钟',exact:true}).fill('01');
  await setting.getByRole('button',{name:'定位',exact:true}).click(); await expect(setting.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('clock')).toHaveText('12:34');
  await setting.getByRole('textbox',{name:'分钟',exact:true}).fill('00');
  await setting.getByRole('textbox',{name:'分钟',exact:true}).press('Enter');
  await expect(setting).not.toBeVisible(); await expect(editor).toBeFocused();
  await expect(page.getByTestId('clock')).toHaveText('24:00'); await expect(page.locator('.map-day')).toHaveText('2026.10.06');
  await editor.click(); await setting.getByRole('textbox',{name:'小时',exact:true}).fill('03'); await page.keyboard.press('Escape');
  await expect(page.getByTestId('clock')).toHaveText('24:00'); await expect(editor).toBeFocused();
  await expect(page.getByRole('button',{name:'看此刻',exact:true})).toHaveAttribute('aria-pressed','false');
  const boxes = await page.locator('.explore-toolbar button').evaluateAll(elements=>elements.map(e=>e.getBoundingClientRect().toJSON()));
  expect(new Set(boxes.map(box=>box.y)).size).toBe(1); expect(boxes.every(box=>box.height>=44)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await screenshot(page,`${info.project.name}-time`);
});
test('分享还原省份和两日摘要，日期2日出定位同步双图，复制失败可手动复制', async ({page},info) => {
  await page.goto('/#scene=v1&d1=2026-06-21&d2=2026-12-22&m=420&r=156440000'); await ready(page);
  expect(new URL(page.url()).hash).toBe(''); await expect(page.getByTestId('map-clock')).toHaveText(['07:00','07:00']);
  const mobile = info.project.name === 'mobile-chromium';
  if (mobile) {
    await expect(page.locator('.mobile-dialog[open]')).toHaveCount(0);
    await page.getByRole('button',{name:'地区详情',exact:true}).click();
  }
  await expect(page.getByRole('heading',{name:'广东省',exact:true})).toBeVisible();
  const summary = page.getByRole('region',{name:'代表点两日对比摘要'});
  await expect(summary).toContainText('减少'); await expect(summary).toContainText('日期2 2026-12-22');
  await screenshot(page,`${info.project.name}-summary`);
  const event = page.locator('.day-details').nth(1).locator('.event-grid dd').first(); const time = await event.innerText();
  await page.getByRole('button',{name:'查看日期2代表点日出',exact:true}).click();
  await expect(page.getByTestId('map-clock')).toHaveText([time,time]);
  if (mobile) await expect(page.locator('.mobile-dialog[open]')).toHaveCount(0);
  await page.getByRole('button',{name:'分享',exact:true}).click();
  const share = page.getByRole('dialog',{name:'分享当前观测',exact:true}); await expect(share).toContainText('广东省');
  const link = await share.getByRole('textbox',{name:'场景链接',exact:true}).inputValue();
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}}));
  await share.getByRole('button',{name:'复制链接',exact:true}).click(); await expect(share.getByRole('status')).toContainText('手动复制');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{document.body.dataset.copied=text;}}}));
  await share.getByRole('button',{name:'复制说明与链接',exact:true}).click(); await expect(share.getByRole('status')).toHaveText('说明与链接已复制');
  expect(await page.locator('body').getAttribute('data-copied')).toContain(link);
  await screenshot(page,`${info.project.name}-share`);
  await page.keyboard.press('Escape'); await expect(page.getByRole('button',{name:'分享',exact:true})).toBeFocused();
  await page.goto(link); await expect.poll(()=>new URL(page.url()).hash).toBe(''); await ready(page); await expect(page.getByTestId('map-clock')).toHaveText([time,time]);
  await page.reload(); await ready(page); await expect(page.getByTestId('clock')).toHaveText('00:00'); await expect(page.locator('.map-pane')).toHaveCount(1);
});
test('过期或非法分享回默认观测，未知省份只丢弃地区', async ({page}) => {
  await page.goto('/#scene=v1&d1=2024-06-21&m=420'); await ready(page);
  await expect(page.getByRole('status')).toContainText('超出当前观测范围'); await expect(page.getByTestId('clock')).toHaveText('00:00');
  await page.goto('/#scene=v1&d1=2026-02-30&m=420'); await expect.poll(()=>new URL(page.url()).hash).toBe(''); await ready(page);
  await expect(page.getByRole('status')).toContainText('分享链接无效'); await expect(page.getByTestId('clock')).toHaveText('00:00');
  await page.goto('/#scene=v1&d1=2026-06-21&m=1440&r=unknown'); await expect.poll(()=>new URL(page.url()).hash).toBe(''); await ready(page);
  await expect(page.getByRole('status')).toContainText('地区信息无法识别'); await expect(page.getByTestId('clock')).toHaveText('24:00');
  await expect(page.locator('.map-day')).toHaveText('2026.06.21（夏至）');
});
