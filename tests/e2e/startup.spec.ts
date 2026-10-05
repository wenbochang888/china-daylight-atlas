import { expect, test } from '@playwright/test';

test.use({ timezoneId:'America/New_York' });
test('内置地图无需JSON请求，首次与刷新使用北京时间今天零点，双图复用数据',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-03T17:38:00Z'));
  const maps:string[]=[], music:string[]=[], errors:string[]=[];
  page.on('request',r=>{if(r.url().includes('/maps/'))maps.push(r.url());if(r.url().endsWith('.mp3'))music.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/maps/**',r=>r.abort());
  await page.goto('/');
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});
  await expect(page.getByTestId('clock')).toHaveText('00:00');
  await expect(page.getByTestId('map-clock')).toHaveText('00:00');
  await expect(page.locator('.map-day')).toHaveText('2026.10.04');
  await expect(page.getByRole('slider',{name:'北京时间时间轴'})).toHaveValue('0');
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360');
  await page.reload();await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});
  await expect(page.getByTestId('clock')).toHaveText('00:00');
  const panel=page.getByRole('button',{name:'日期与节气',exact:true});if(await panel.isVisible())await panel.click();
  await page.getByRole('button',{name:'两天对比',exact:true}).click();
  const close=page.getByRole('button',{name:'关闭面板',exact:true});if(await close.isVisible())await close.click();
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});
  await expect(page.getByTestId('map-clock')).toHaveText(['00:00','00:00']);
  await expect(page.locator('.map-day')).toHaveText(['2026.10.04','2026.10.03']);
  const labels=await page.locator('.map-pane').evaluateAll(elements=>elements.map(e=>({
    provinces:new Set((e as any).__vueParentComponent.exposed.getProvinceLabels()).size,
    islands:new Set((e as any).__vueParentComponent.exposed.getInsetLabels()).size,
  })));
  const mobile=await page.locator('.atlas-app').evaluate(e=>e.classList.contains('mobile-presentation'));
  expect(labels.every(value=>value.provinces===34 && (mobile ? value.islands===0 : value.islands>=6))).toBe(true);
  expect(maps).toEqual([]);expect(music).toEqual([]);expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
