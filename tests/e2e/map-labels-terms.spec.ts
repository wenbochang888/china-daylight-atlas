import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { chooseDate } from '../helpers/date-picker';

const output='docs/validation-images/map-labels-terms';
async function ready(page:Page) { await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000}); }
async function datePanel(page:Page) { const button=page.getByRole('button',{name:'日期与节气',exact:true});if(await button.isVisible())await button.click(); }
async function closePanel(page:Page) { const button=page.getByRole('button',{name:'关闭面板',exact:true});if(await button.isVisible())await button.click(); }
async function labels(page:Page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect.poll(()=>page.locator('.map-pane').evaluateAll(elements=>elements.map(e=>(e as any).__vueParentComponent.exposed.getProvinceLabelLayout().length))).toEqual(Array(await page.locator('.map-pane').count()).fill(34));
  for(const pane of await page.locator('.map-pane').all()) {
    const result=await pane.evaluate(async e=>{
      const exposed=(e as any).__vueParentComponent.exposed;
      const positions=exposed.getProvinceLabelLayout() as {id:string;x:number;y:number;inside:boolean;box:{left:number;right:number;top:number;bottom:number}}[];
      // Test the real rendered centre against the province fill, independently of the placement flag.
      const wrong=positions.filter(p=>{
        const hit=exposed.getProvinceAtPoint({x:p.x,y:p.y});
        return p.inside?hit!==p.id:!!hit&&hit!==p.id;
      }).map(p=>p.id);
      const collisions:string[]=[];
      for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++) {
        const a=positions[i].box,b=positions[j].box;
        if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)collisions.push(`${positions[i].id}/${positions[j].id}`);
      }
      return {wrong,collisions,inside:positions.filter(p=>p.inside).length};
    });
    expect(result.wrong).toEqual([]);expect(result.collisions).toEqual([]);
  }
}
test.beforeEach(async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-05T04:00:00Z'));
});
test('日期后括号显示节气，双图和全屏匹配且24:00不换节气',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);await expect(page.getByTestId('map-solar-term')).toHaveCount(0);
  await datePanel(page);await chooseDate(page,0,'2026-06-21');await closePanel(page);await ready(page);
  await expect(page.getByTestId('map-solar-term')).toHaveText('（夏至）');
  await expect(page.locator('.map-day')).toHaveText('2026.06.21（夏至）');
  const dateLayout=await page.locator('.map-day').evaluate(e=>{
    const term=e.querySelector('span')!.getBoundingClientRect(),date=e.getBoundingClientRect();
    return {inline:term.top>=date.top&&term.bottom<=date.bottom+1,contained:term.right<=date.right+1};
  });
  expect(dateLayout).toEqual({inline:true,contained:true});
  const camera=await page.locator('.map-pane').evaluate(e=>(e as any).__vueParentComponent.exposed.getView());
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('1440');
  await expect(page.getByTestId('map-clock')).toHaveText('24:00');await expect(page.getByTestId('map-solar-term')).toHaveText('（夏至）');
  await datePanel(page);await chooseDate(page,0,'2026-06-22');await closePanel(page);await ready(page);
  await expect(page.getByTestId('map-solar-term')).toHaveCount(0);
  await expect(page.locator('.map-day')).toHaveText('2026.06.22');
  expect(await page.locator('.map-pane').evaluate(e=>(e as any).__vueParentComponent.exposed.getView())).toEqual(camera);
  await datePanel(page);await chooseDate(page,0,'2026-03-20');await closePanel(page);await ready(page);
  await expect(page.locator('.map-day')).toHaveText('2026.03.20（春分）');
  await datePanel(page);await page.getByRole('button',{name:'两天对比',exact:true}).click();
  await chooseDate(page,0,'2025-12-21');await chooseDate(page,1,'2026-06-21');await closePanel(page);await ready(page);
  await expect(page.getByTestId('map-solar-term')).toHaveText(['（冬至）','（夏至）']);await labels(page);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('420');
  mkdirSync(output,{recursive:true});await page.screenshot({path:`${output}/${info.project.name}-inline-terms.png`,fullPage:true});
  await page.getByRole('button',{name:'全屏查看地图',exact:true}).click();
  await expect(page.getByRole('button',{name:'退出全屏',exact:true})).toBeVisible();
  await expect(page.locator('.map-day')).toHaveText(['2025.12.21（冬至）','2026.06.21（夏至）']);
  for(const day of await page.locator('.map-day').all())expect(await day.evaluate(e=>{
    const date=e.getBoundingClientRect(),term=e.querySelector('span')!.getBoundingClientRect(),pane=e.closest('.map-pane')!.getBoundingClientRect();
    return term.top>=date.top&&term.bottom<=date.bottom+1&&date.left>=pane.left&&date.right<=pane.right;
  })).toBe(true);
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();
  await expect(page.locator('.map-toolbar')).toBeVisible();
  await datePanel(page);await page.getByRole('button',{name:'退出对比',exact:true}).click();
  await page.locator('.term-button').filter({hasText:'冬至'}).click();await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'暂停播放',exact:true}).click();await expect(page.getByTestId('map-solar-term')).toHaveText('（冬至）');
  expect(errors).toEqual([]);
});
test('省级标注保持正确归属、无重叠，窄图钓鱼岛短名和主题切换',async({page},info)=>{
  await page.goto('/');await ready(page);
  for(const size of [{width:360,height:800},{width:390,height:844},{width:599,height:900},{width:600,height:900},{width:844,height:390},{width:1440,height:1000}]) {
    await page.setViewportSize(size);await labels(page);
    const compact=await page.locator('.map-pane').evaluate(e=>document.querySelector('.atlas-app')!.classList.contains('mobile-presentation')||e.querySelector('.map-canvas')!.clientWidth<600);
    await expect.poll(()=>page.locator('.map-pane').evaluate(e=>(e as any).__vueParentComponent.exposed.getDiaoyuText())).toBe(compact?'钓鱼岛':'钓鱼岛及其\n附属岛屿');
    await expect.poll(()=>page.locator('.map-pane').evaluate(e=>new Set((e as any).__vueParentComponent.exposed.getProvinceLabels()).size).catch(()=>0)).toBe(34);
    if(size.width===390) {
      expect(await page.locator('.map-pane').evaluate(e=>(e as any).__vueParentComponent.exposed.getProvinceLabelLayout().filter((p:any)=>p.inside).length)).toBeGreaterThanOrEqual(24);
      await page.getByRole('slider',{name:'北京时间时间轴'}).fill('720');
      await page.getByRole('switch',{name:'暗色模式',exact:true}).click();
      await labels(page);mkdirSync(output,{recursive:true});await page.screenshot({path:`${output}/${info.project.name}-390-dark.png`,fullPage:true});
      await page.getByRole('switch',{name:'暗色模式',exact:true}).click();
    }
  }
});
