import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { chooseDate } from '../helpers/date-picker';

const output = 'docs/validation-images/comparison-alignment';
async function scenes(page: Page) {
  return page.locator('.map-pane').evaluateAll(panes => panes.map(pane => {
    const exposed = (pane as any).__vueParentComponent.exposed;
    const canvas = pane.querySelector('.map-canvas')!.getBoundingClientRect();
    const card = pane.querySelector('.map-info')!.getBoundingClientRect();
    const bounds = exposed.getSceneBounds();
    return { alignment: pane.getAttribute('data-comparison-align'), top: bounds.top, bottom: bounds.bottom,
      height: canvas.height, y: canvas.y, cardTop: card.top-canvas.top, cardBottom:card.bottom-canvas.top, outlineTop:exposed.getOutlineTop(), cardLeft: card.left-canvas.left,
      cardRight: card.right-canvas.left, width: canvas.width, view: exposed.getView(),
      boxes: exposed.getProvinceLabelLayout().map((p: any) => p.box) };
  }));
}
async function checkAligned(page: Page) {
  await expect.poll(()=>page.locator('.map-pane').evaluateAll(panes=>panes.map(pane=>(pane as any).__vueParentComponent.exposed.isLoaded())),{timeout:15000}).toEqual([true,true]);
  await expect.poll(()=>page.locator('.map-pane').evaluateAll(panes=>panes.map(pane=>{
    const exposed=(pane as any).__vueParentComponent.exposed;
    if (!exposed.isLoaded()) return 0;
    // Symbol indices can be replaced between two reads during a MapLibre worker update.
    try { return new Set(exposed.getProvinceLabels()).size; } catch { return 0; }
  })),{timeout:15000}).toEqual([34,34]);
  await expect.poll(async () => {
    const [first,second] = await scenes(page);
    return [Math.round(first.height-first.bottom),Math.round(second.top)];
  }).toEqual([12,12]);
  const [first,second] = await scenes(page);
  expect(first.alignment).toBe('bottom');expect(second.alignment).toBe('top');
  expect(second.y-(first.y+first.height)).toBeCloseTo(1,0); // 1px separator
  expect(first.view.zoom).toBeCloseTo(second.view.zoom,8);
  expect(first.view.center).toEqual(second.view.center);
  for (const scene of [first,second]) {
    expect(scene.top).toBeGreaterThanOrEqual(0);expect(scene.bottom).toBeLessThanOrEqual(scene.height);
    expect(scene.cardLeft).toBeGreaterThanOrEqual(0);expect(scene.cardRight).toBeLessThanOrEqual(scene.width);
    expect(scene.outlineTop-scene.cardBottom).toBeGreaterThanOrEqual(11.5);
    for (const box of scene.boxes) {
      expect(box.top).toBeGreaterThanOrEqual(0);expect(box.bottom).toBeLessThanOrEqual(scene.height);
    }
  }
  for (const pane of await page.locator('.map-pane').all()) {
    const labels = await pane.evaluate(pane => {
      const exposed=(pane as any).__vueParentComponent.exposed;
      const positions=exposed.getProvinceLabelLayout();
      return { guangdong:positions.find((p:any)=>p.id==='156440000')?.inside,
        wrong:positions.filter((p:any)=>{
          const hit=exposed.getProvinceAtPoint({x:p.x,y:p.y});
          return p.inside ? hit!==p.id : !!hit&&hit!==p.id;
        }).map((p:any)=>p.id) };
    });
    expect(labels.guangdong).toBe(true);expect(labels.wrong).toEqual([]);
  }
}

test('手机竖屏全屏双图靠近中线，旋转及退出保持日期、时间、实例与节气样式', async ({ page },info) => {
  await page.clock.setFixedTime(new Date('2026-10-05T04:00:00Z'));
  await page.addInitScript(() => Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{configurable:true,value:undefined}));
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});
  await page.getByRole('button',{name:'日期与节气',exact:true}).click();
  await page.getByRole('button',{name:'两天对比',exact:true}).click();
  await chooseDate(page,0,'2026-06-21');await chooseDate(page,1,'2026-12-22');
  await page.getByRole('button',{name:'关闭面板',exact:true}).click();
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('202');
  await expect.poll(async () => (await scenes(page)).map(s=>s.alignment)).toEqual(['center','center']);
  const canvases = await page.locator('.map-canvas canvas').elementHandles();
  const audio = await page.locator('audio').elementHandle();
  await page.getByRole('button',{name:'全屏查看地图',exact:true}).click();
  await expect(page.getByRole('button',{name:'退出全屏',exact:true})).toBeVisible();
  for (const size of [{width:390,height:844},{width:360,height:800},{width:430,height:932}]) {
    await page.setViewportSize(size);await checkAligned(page);
    await expect(page.locator('.map-day')).toHaveText(['2026.06.21（夏至）','2026.12.22（冬至）']);
    for (const term of await page.getByTestId('map-solar-term').all()) {
      expect(await term.evaluate(e => {
        const style=getComputedStyle(e),date=getComputedStyle(e.parentElement!);
        return style.display==='inline'&&style.fontSize===date.fontSize&&style.borderTopWidth==='0px';
      })).toBe(true);
    }
    mkdirSync(output,{recursive:true});await page.screenshot({path:`${output}/${info.project.name}-${size.width}.png`});
  }
  const safeStyle = await page.addStyleTag({content:'.immersive-pane[data-comparison-align="bottom"]{padding-top:59px}.immersive-pane[data-comparison-align="top"]{padding-bottom:34px}.immersive .map-view-controls{top:71px}'});
  await page.setViewportSize({width:390,height:845});await checkAligned(page);
  expect((await scenes(page))[0].cardTop).toBeGreaterThanOrEqual(71);
  const lower = (await scenes(page))[1];expect(lower.bottom).toBeLessThanOrEqual(lower.height-34);
  await safeStyle.evaluate(element=>element.parentNode?.removeChild(element));
  await page.setViewportSize({width:844,height:390});
  await expect.poll(async () => (await scenes(page)).map(s=>s.alignment)).toEqual(['center','center']);
  await expect.poll(async () => (await scenes(page)).map(s=>s.y)).toEqual([0,0]);
  await page.setViewportSize({width:390,height:844});await checkAligned(page);
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();
  await expect(page.locator('.map-toolbar')).toBeVisible();
  await expect.poll(async () => (await scenes(page)).map(s=>s.alignment)).toEqual(['center','center']);
  await expect(page.getByTestId('map-clock')).toHaveText(['03:22','03:22']);
  for (let i=0;i<canvases.length;i++) expect(await canvases[i].evaluate((canvas,index)=>canvas===document.querySelectorAll('.map-canvas canvas')[index],i)).toBe(true);
  expect(await audio!.evaluate(element=>element===document.querySelector('audio'))).toBe(true);
});
