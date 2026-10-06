import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function ready(page:Page) {
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});
  await expect(page.locator('.maps')).not.toHaveClass(/scene-changing/);
  await expect.poll(()=>page.locator('.map-pane').evaluateAll(panes=>panes.map(pane=>getComputedStyle(pane).opacity))).toEqual(Array(await page.locator('.map-pane').count()).fill('1'));
  await expect.poll(()=>page.locator('.map-pane').evaluateAll(panes=>panes.map(pane=>(pane as any).__vueParentComponent.exposed.getProvinceLabelLayout().length))).toEqual(Array(await page.locator('.map-pane').count()).fill(34));
}
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-06T04:34:00Z'));});
test('PC与H5反复切换不产生地图表达式错误，保留主图实例',async({page},info)=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/');await ready(page);
  const canvas=await page.locator('.map-canvas canvas').first().elementHandle();
  for(const size of [{width:1440,height:1000},{width:360,height:800},{width:599,height:800},{width:600,height:800},{width:1440,height:1000},{width:360,height:800}]){
    await page.setViewportSize(size);await ready(page);
    await expect(page.locator('.map-error')).toHaveCount(0);
    expect(await canvas!.evaluate(element=>element.isConnected)).toBe(true);
  }
  await mkdir('docs/validation-images/scene-transition',{recursive:true});
  await page.screenshot({path:`docs/validation-images/scene-transition/${info.project.name}-resized.png`,fullPage:true});
  expect(errors).toEqual([]);
});
test('三个精选场景在淡出后更新，标注绘制完成才显示，反馈不改变单图高度',async({page},info)=>{
  await page.goto('/');await ready(page);
  await page.evaluate(()=>{
    const maps=document.querySelector('.maps')!;
    (window as any).sceneChanges=[];
    let previous=[...maps.querySelectorAll('.map-day,.map-time-value strong')].map(node=>node.textContent).join('|');
    new MutationObserver(()=>{
      const current=[...maps.querySelectorAll('.map-day,.map-time-value strong')].map(node=>node.textContent).join('|');
      if(current!==previous){
        (window as any).sceneChanges.push([...maps.querySelectorAll('.map-pane')].map(pane=>Number(getComputedStyle(pane).opacity)));
        previous=current;
      }
    }).observe(maps,{subtree:true,childList:true,characterData:true});
  });
  const before=await page.locator('.map-pane').first().boundingBox();
  for(const name of ['看晨光','冬夏对比','看此刻']){
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.maps')).toHaveClass(/scene-changing/);
    await ready(page);
    await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeVisible();
  }
  const changes=await page.evaluate(()=>(window as any).sceneChanges as number[][]);
  expect(changes.length).toBeGreaterThanOrEqual(3);
  expect(changes.every(values=>values.every(value=>value<=0.01))).toBe(true);
  const after=await page.locator('.map-pane').first().boundingBox();
  expect(after?.y).toBeCloseTo(before!.y,0);expect(after?.height).toBeCloseTo(before!.height,0);
  await page.getByRole('button',{name:'冬夏对比',exact:true}).click();
  await expect(page.locator('.maps')).toHaveClass(/scene-changing/);
  await page.getByRole('button',{name:'看此刻',exact:true}).click();await ready(page);
  await expect(page.locator('.map-pane')).toHaveCount(1);await expect(page.getByTestId('map-clock')).toHaveText('12:34');
  await expect(page.getByRole('button',{name:'看此刻',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'看晨光',exact:true}).click();await ready(page);
  expect(await page.locator('.map-pane').evaluate(pane=>getComputedStyle(pane).transitionDuration)).toBe('0s');
  await mkdir('docs/validation-images/scene-transition',{recursive:true});
  await page.screenshot({path:`docs/validation-images/scene-transition/${info.project.name}-scene.png`,fullPage:true});
});
