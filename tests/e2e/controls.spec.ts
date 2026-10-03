import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { chooseDate } from '../helpers/date-picker';
const pageErrors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const errors:string[]=[];pageErrors.set(page,errors);page.on('pageerror',e=>errors.push(e.message));});
test.afterEach(({page})=>expect(pageErrors.get(page)).toEqual([]));
async function ready(page:Page){await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});}
async function datePanel(page:Page){const b=page.getByRole('button',{name:'日期与节气',exact:true});if(await b.isVisible())await b.click();}
async function closePanel(page:Page){const b=page.getByRole('button',{name:'关闭面板',exact:true});if(await b.isVisible())await b.click();}
async function seek(page:Page,value:number){await page.getByRole('slider',{name:'北京时间时间轴'}).fill(String(value));}

test('日期文字、图标和整框均打开中文日历，关闭恢复焦点',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page);await datePanel(page);
  const date=page.getByRole('button',{name:'日期 1',exact:true}),menu=page.getByRole('dialog',{name:'选择观测日期',exact:true});
  await expect(date).toHaveAccessibleDescription((await date.getAttribute('data-date'))!);
  for(const target of [date.locator('time'),date.locator('svg'),date]){
    await target.click();await expect(menu).toBeVisible();await expect(page.getByRole('button',{name:'下个月',exact:true})).toBeVisible();
    const bounds=(await menu.boundingBox())!,viewport=page.viewportSize()!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width);
    if(info.project.name!=='desktop-chromium')expect(await menu.evaluate(e=>!!e.closest('.mobile-dialog[open]'))).toBe(true);
    await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(date).toBeFocused();
  }
  await date.press('Enter');await expect(menu).toBeVisible();await page.keyboard.press('Escape');
  await expect(page.locator('.term-note')).toHaveCount(4);await expect(page.locator('.term-button').filter({hasText:'春分'})).toContainText('昼夜近等长');
  await expect(page.locator('.term-button').filter({hasText:'夏至'})).toContainText('长昼节点');await expect(page.locator('.term-button').filter({hasText:'冬至'})).toContainText('短昼节点');
  await expect(page.getByText('节气计算依据 · 香港天文台')).toHaveCount(0);await expect(page.getByText('日出日落分界 −0.8333°')).toHaveCount(0);
  if(info.project.name!=='desktop-chromium'){
    await expect(page.locator('.mobile-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.mobile-dialog')).not.toBeVisible();
    await expect(page.getByRole('button',{name:'日期与节气',exact:true})).toBeFocused();
  }
  expect(errors).toEqual([]);
});

test('纽约设备时区、闰日与跨年范围不改变北京时间日期，双日期独立选择',async({page})=>{
  await page.clock.setFixedTime(new Date('2028-02-29T04:00:00Z'));await page.goto('/');await ready(page);await datePanel(page);
  const date=page.getByRole('button',{name:'日期 1',exact:true});
  await expect(date).toHaveAttribute('data-date','2028-02-29');await expect(date).toHaveAttribute('data-min','2027-01-01');
  await expect(date).toHaveAttribute('data-max','2028-12-31');
  await date.click();await page.getByRole('button',{name:/选择年份$/}).click();
  await page.getByRole('option',{name:'2027',exact:true}).click();await page.getByRole('button',{name:/选择月份$/}).click();
  await page.getByRole('option',{name:'12月',exact:true}).click();
  await page.getByRole('gridcell',{name:'2027-12-31',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'选择观测日期',exact:true})).toHaveCount(0);await expect(date).toBeFocused();
  await expect(date).toHaveAttribute('data-date','2027-12-31');await page.getByRole('button',{name:'两天对比',exact:true}).click();await closePanel(page);await ready(page);await datePanel(page);
  await expect(page.getByRole('button',{name:'日期 2',exact:true})).toHaveAttribute('data-date','2027-12-30');
  await chooseDate(page,1,'2028-01-01');await expect(date).toHaveAttribute('data-date','2027-12-31');
  await closePanel(page);await expect(page.locator('.map-day').first()).toHaveText('2027.12.31');await expect(page.locator('.map-day').nth(1)).toHaveText('2028.01.01');
});

test('时间轴点击、拖动及键盘即时更新，操作后暂停，24:00日期不变',async({page},info)=>{
  await page.goto('/');await ready(page);const slider=page.getByRole('slider',{name:'北京时间时间轴'}),clock=page.getByTestId('clock');
  const date=await page.locator('.map-day').innerText();await seek(page,720);await expect(clock).toHaveText('12:00');await expect(page.getByTestId('map-clock')).toHaveText('12:00');
  await page.getByRole('button',{name:'开始播放',exact:true}).click();
  const bounds=(await slider.boundingBox())!;
  if(info.project.name==='desktop-chromium'){
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();
    await page.mouse.move(bounds.x+bounds.width/4,bounds.y+bounds.height/2,{steps:8});await page.mouse.up();
  }else{await slider.tap({position:{x:bounds.width/4,y:bounds.height/2}});}
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeVisible();
  const paused=await clock.innerText();await page.waitForTimeout(200);await expect(clock).toHaveText(paused);
  expect(Number(await slider.inputValue())).toBeLessThan(720);
  await slider.focus();await slider.press('Home');await expect(clock).toHaveText('00:00');await expect(page.getByTestId('map-clock')).toHaveText('00:00');await slider.press('ArrowRight');await expect(clock).toHaveText('00:01');
  await slider.press('End');await expect(clock).toHaveText('24:00');await expect(page.getByTestId('map-clock')).toHaveText('24:00');await expect(page.locator('.map-day')).toHaveText(date);
  await page.getByRole('button',{name:'开始播放',exact:true}).click();await expect.poll(async()=>Number(await slider.inputValue())).toBeLessThan(180);
  await seek(page,720);await expect(clock).toHaveText('12:00');await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeVisible();
});

test('双图共用一条时间轴，拖动同步主图、附图和地点详情',async({page})=>{
  await page.goto('/');await ready(page);await datePanel(page);await page.getByRole('button',{name:'两天对比',exact:true}).click();await closePanel(page);await ready(page);
  const slider=page.getByRole('slider',{name:'北京时间时间轴'});await expect(slider).toHaveCount(1);
  const point=await page.locator('.map-pane').first().evaluate(e=>(e as any).__vueParentComponent.exposed.projectPoint([112.933419,28.23129]));
  await page.locator('.map-canvas').first().click({position:{x:point.x,y:point.y}});
  await expect(page.locator('.detail-loading')).toHaveCount(0,{timeout:30000});await closePanel(page);
  await seek(page,0);await expect(page.getByTestId('clock')).toHaveText('00:00');await expect(page.getByTestId('map-clock')).toHaveText(['00:00','00:00']);
  const canvases=page.locator('.map-canvas canvas,.inset-canvas canvas');await expect(canvases).toHaveCount(4);
  const before=[];for(let i=0;i<4;i++)before.push(await canvases.nth(i).screenshot());
  const details=page.getByRole('button',{name:'地区详情',exact:true});if(await details.isVisible())await details.click();
  await expect(page.getByRole('heading',{name:'湖南省',exact:true})).toBeVisible();
  await expect(page.locator('.light-state')).toHaveText(['黑夜','黑夜']);await closePanel(page);
  await seek(page,720);await expect(page.getByTestId('clock')).toHaveText('12:00');await expect(page.getByTestId('map-clock')).toHaveText(['12:00','12:00']);
  for(let i=0;i<4;i++)expect((await canvases.nth(i).screenshot()).equals(before[i])).toBe(false);
  if(await details.isVisible())await details.click();await expect(page.locator('.light-state')).toHaveText(['白天','白天']);await closePanel(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('横屏日历完整落在屏幕内，底部日期可点击，关闭面板后可重开',async({page})=>{
  await page.setViewportSize({width:844,height:390});await page.clock.setFixedTime(new Date('2026-10-03T04:00:00Z'));
  await page.goto('/');await ready(page);await datePanel(page);await chooseDate(page,0,'2026-06-01');
  const date=page.getByRole('button',{name:'日期 1',exact:true});await date.click();
  const menu=page.getByRole('dialog',{name:'选择观测日期',exact:true});await expect(menu).toBeVisible();
  await expect.poll(async()=>{const b=(await menu.boundingBox())!;return b.y>=0&&b.y+b.height<=390;}).toBe(true);
  await page.getByRole('gridcell',{name:'2026-06-30',exact:true}).click();await expect(date).toHaveAttribute('data-date','2026-06-30');
  await closePanel(page);await expect(page.locator('.mobile-dialog')).not.toBeVisible();await datePanel(page);
  await expect(date).toHaveAttribute('data-date','2026-06-30');
});

test('两整年当年节气、固定底栏和34省名在单图与双图中可用',async({page},info)=>{
  await page.clock.setFixedTime(new Date('2026-10-03T04:00:00Z'));await page.goto('/');await ready(page);
  const slider=page.getByRole('slider',{name:'北京时间时间轴'}),bar=page.locator('.fixed-timeline');
  const labels=()=>page.locator('.map-pane').evaluateAll(elements=>elements.map(e=>new Set((e as any).__vueParentComponent.exposed.getProvinceLabels()).size));
  await expect.poll(labels).toEqual([34]);
  await expect(page.locator('.map-day')).toHaveText('2026.10.03');
  await expect(page.locator('.map-tools,.map-credit,.level-chip,.map-heading')).toHaveCount(0);
  const geometry=await page.evaluate(()=>{
    const map=document.querySelector('.map-workspace')!.getBoundingClientRect(),bar=document.querySelector('.fixed-timeline')!.getBoundingClientRect();
    const date=document.querySelector('.map-day')!.getBoundingClientRect(),caption=document.querySelector('.map-time span')!.getBoundingClientRect();
    return {left:Math.abs(map.left-bar.left),width:Math.abs(map.width-bar.width),bottom:Math.abs(innerHeight-bar.bottom),ordered:date.bottom<=caption.top};
  });
  expect(geometry.left).toBeLessThan(1);expect(geometry.width).toBeLessThan(1);expect(geometry.bottom).toBeLessThan(1);expect(geometry.ordered).toBe(true);
  await datePanel(page);
  const date=page.getByRole('button',{name:'日期 1',exact:true});
  await expect(date).toHaveAttribute('data-min','2025-01-01');await expect(date).toHaveAttribute('data-max','2026-12-31');
  expect((await page.locator('.term-button small').allTextContents()).every(value=>value.startsWith('2026-'))).toBe(true);
  await chooseDate(page,0,'2026-12-31');await closePanel(page);await expect(page.locator('.map-day')).toHaveText('2026.12.31');
  await seek(page,1146);await expect(page.getByTestId('map-clock')).toHaveText('19:06');
  mkdirSync('docs/validation-images/layout-two-year',{recursive:true});
  await page.screenshot({path:`docs/validation-images/layout-two-year/${info.project.name.includes('mobile')?'mobile':'desktop'}.png`,fullPage:true});
  await datePanel(page);await chooseDate(page,0,'2025-01-01');await page.getByRole('button',{name:'两天对比',exact:true}).click();await closePanel(page);await ready(page);
  await expect(slider).toHaveCount(1);await expect.poll(labels).toEqual([34,34]);
  await page.evaluate(()=>{window.scrollTo(0,document.documentElement.scrollHeight);const map=document.querySelector('.map-workspace')!;map.scrollTop=map.scrollHeight;});
  const bounds=(await bar.boundingBox())!;expect(bounds.y+bounds.height).toBeCloseTo(page.viewportSize()!.height,0);
  await slider.focus();await slider.press('Home');await slider.press('ArrowRight');await expect(page.getByTestId('map-clock')).toHaveText(['00:01','00:01']);
  await slider.press('End');await expect(page.getByTestId('map-clock')).toHaveText(['24:00','24:00']);
  await page.getByRole('button',{name:'开始播放',exact:true}).click();
  await slider.scrollIntoViewIfNeeded();const input=(await slider.boundingBox())!;
  if(info.project.name.includes('mobile'))await slider.tap({position:{x:input.width/4,y:input.height/2}});
  else{
    await page.mouse.move(input.x+input.width/2,input.y+input.height/2);await page.mouse.down();
    await page.mouse.move(input.x+input.width/4,input.y+input.height/2,{steps:4});await page.mouse.up();
  }
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeVisible();expect(Number(await slider.inputValue())).toBeGreaterThan(0);
  const point=await page.locator('.map-pane').first().evaluate(e=>(e as any).__vueParentComponent.exposed.getProvinceLabelPoint('156430000'));
  await page.locator('.map-canvas').first().click({position:{x:point.x,y:point.y}});
  await expect(page.getByRole('heading',{name:'湖南省',exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'行政区路径'}).getByRole('button',{name:'全国',exact:true}).click();
  await page.getByRole('button',{name:'开始播放',exact:true}).click();
  await page.clock.setFixedTime(new Date('2026-10-04T04:00:00Z'));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-12-31T16:00:00Z'));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await ready(page);await expect(page.locator('.map-day')).toHaveText(['2026.01.01','2026.01.01']);
  await datePanel(page);await expect(page.getByRole('button',{name:'日期 1',exact:true})).toHaveAttribute('data-max','2027-12-31');
  expect((await page.locator('.term-button small').allTextContents()).every(value=>value.startsWith('2027-'))).toBe(true);
  await closePanel(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test.use({timezoneId:'America/New_York'});
