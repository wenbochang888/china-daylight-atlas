import { expect, test, type Page } from '@playwright/test';
import { chooseDate } from '../helpers/date-picker';
async function ready(page:Page){await expect(page.getByText('正在准备地图…')).toHaveCount(0,{timeout:30000});await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});}
async function datePanel(page:Page){const b=page.getByRole('button',{name:'日期与节气',exact:true});if(await b.isVisible()&& !await page.getByRole('dialog').isVisible())await b.click();}
async function closePanel(page:Page){const b=page.getByRole('button',{name:'关闭面板'});if(await b.isVisible())await b.click();}
async function view(page:Page,i=0){return page.locator('.map-pane').nth(i).evaluate(e=>(e as any).__vueParentComponent.exposed.getView());}
async function rendered(page:Page){await expect.poll(()=>page.locator('.map-pane').first().evaluate(e=>(e as any).__vueParentComponent.exposed.isLoaded()),{timeout:30000}).toBe(true);}
async function clickMap(page:Page,point:[number,number]){
  await rendered(page);
  const p=await page.locator('.map-pane').first().evaluate((e,point)=>(e as any).__vueParentComponent.exposed.projectPoint(point),point);
  await page.locator('.map-canvas').first().click({position:{x:p.x,y:p.y}});
  await expect(page.locator('.detail-loading')).toHaveCount(0,{timeout:30000});
  await rendered(page);
}
async function details(page:Page){const b=page.getByRole('button',{name:'地区详情',exact:true});if(await b.isVisible() && !await page.locator('.mobile-dialog').isVisible())await b.click();}
async function clickLabel(page:Page,id:string){
  await rendered(page);
  const position=await page.locator('.map-pane').first().evaluate((e,id)=>(e as any).__vueParentComponent.exposed.getProvinceLabelPoint(id),id);
  await page.locator('.map-canvas').first().click({position});
}

test('观测栏／手机面板、节气自动播放、普通换日保留时分、两天对比',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page);
  await expect(page.getByRole('heading',{name:'中国昼夜地图'})).toBeVisible();
  await expect(page.getByRole('slider',{name:'北京时间时间轴'})).toHaveCount(1);await expect(page.getByLabel('查找地区')).toHaveCount(0);
  await expect(page.locator('.legend')).toHaveText('白天黑夜');
  await datePanel(page);await expect(page.locator('.term-button')).toHaveCount(24);
  const term=page.locator('.term-button').filter({hasText:'夏至'});const termDate=await term.locator('small').innerText();
  await term.click();await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  await expect(page.locator('.map-day')).toHaveText(termDate.replaceAll('-','.'));
  await page.waitForTimeout(400);await page.getByRole('button',{name:'暂停播放',exact:true}).click();
  const clock=await page.getByTestId('clock').innerText();expect(clock).not.toBe('00:00');
  await datePanel(page);const input=page.getByLabel('日期 1',{exact:true});const max=(await input.getAttribute('data-max'))!;
  await chooseDate(page,0,max);await expect(page.getByTestId('clock')).toHaveText(clock);
  await page.getByRole('button',{name:'两天对比',exact:true}).click();await closePanel(page);await ready(page);
  await expect(page.locator('.map-pane')).toHaveCount(2);
  const a=await view(page),b=await view(page,1);expect(b.zoom).toBeCloseTo(a.zoom,4);expect(b.maxZoom).toBe(a.maxZoom);
  await datePanel(page);await page.getByRole('button',{name:'节气应用于日期 2',exact:true}).click();
  await page.locator('.term-button').filter({hasText:'冬至'}).click();await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'暂停播放',exact:true}).click();
  expect((await page.locator('.map-day').allTextContents())[0]).toBe(max.replaceAll('-','.'));
  await datePanel(page);await page.getByRole('button',{name:'退出对比',exact:true}).click();await closePanel(page);
  await expect(page.locator('.map-pane')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);await expect(page.locator('.map-error')).toHaveCount(0);
});

test('固定全国图仅点击省级详情，所有手势不移动视角，双图保持同步',async({page},info)=>{
  const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/maps/regions/'))requests.push(r.url());});
  await page.goto('/');await ready(page);const initial=await view(page);
  await expect(page.getByRole('button',{name:'放大地图',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'缩小地图',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'查看全境',exact:true})).toHaveCount(0);
  await clickLabel(page,'156410000');await details(page);
  await expect(page.getByRole('heading',{name:'河南省',exact:true})).toBeVisible();
  expect(await view(page)).toEqual(initial);await closePanel(page);
  if(info.project.name.includes('mobile'))await expect(page.getByRole('button',{name:'地区详情',exact:true})).toBeFocused();
  const canvas=page.locator('.map-canvas canvas').first();await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  if(info.project.name==='mobile-webkit')await canvas.dispatchEvent('wheel',{deltaY:-800});
  else await page.mouse.wheel(0,-800);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2+40,{steps:5});await page.mouse.up();
  await canvas.dblclick({position:{x:box.width/2,y:box.height/2}});await closePanel(page);
  await canvas.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');
  if(info.project.name.includes('mobile')){
    const touches=(distance:number)=>[0,1].map(i=>({identifier:i,clientX:box.x+box.width/2+(i===0?-distance:distance),clientY:box.y+box.height/2}));
    await canvas.dispatchEvent('touchstart',{touches:touches(25),targetTouches:touches(25),changedTouches:touches(25)});
    await canvas.dispatchEvent('touchmove',{touches:touches(85),targetTouches:touches(85),changedTouches:touches(85)});
    await canvas.dispatchEvent('touchend',{touches:[],targetTouches:[],changedTouches:touches(85)});
    expect(await canvas.evaluate(e=>getComputedStyle(e).touchAction)).toBe('pan-y');
  }
  await page.waitForTimeout(250);expect(await view(page)).toEqual(initial);
  await details(page);await page.getByRole('navigation',{name:'行政区路径'}).getByRole('button',{name:'全国',exact:true}).click();expect(await view(page)).toEqual(initial);
  await datePanel(page);await page.getByRole('button',{name:'两天对比',exact:true}).click();await closePanel(page);await ready(page);
  const a=await view(page),b=await view(page,1);expect(b.center).toEqual(a.center);expect(b.zoom).toBeCloseTo(a.zoom,4);
  await clickLabel(page,'156460000');await details(page);await expect(page.getByRole('heading',{name:'海南省',exact:true})).toBeVisible();
  expect(await view(page)).toEqual(a);expect(await view(page,1)).toEqual(b);
  expect(requests).toEqual([]);
});

test('台湾、直辖市及港澳省名均能点击，不进入下级',async({page})=>{
  await page.goto('/');await ready(page);const initial=await view(page);
  for(const [id,name] of [['156710000','台湾省'],['156110000','北京市'],['156810000','香港特别行政区'],['156820000','澳门特别行政区']] as const){
    await rendered(page);
    const position=await page.locator('.map-pane').evaluate((e,id)=>(e as any).__vueParentComponent.exposed.getProvinceLabelPoint(id),id);
    await page.locator('.map-canvas').click({position});
    await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
    expect(await view(page)).toEqual(initial);await expect(page.locator('.level-chip')).toHaveCount(0);
    await closePanel(page);
  }
});

test('快速节气选择以最后一次为准，后台暂停后不自行恢复',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','竞态与后台故障注入桌面验证');
  await page.goto('/');await ready(page);
  // A second map uses cached data but still has asynchronous graphics initialization.
  await page.getByRole('button',{name:'两天对比',exact:true}).click();
  await page.locator('.term-button').filter({hasText:'夏至'}).click();
  await page.locator('.term-button').filter({hasText:'冬至'}).click();
  const date=await page.locator('.term-button').filter({hasText:'冬至'}).locator('small').innerText();
  await expect(page.locator('.map-day').first()).toHaveText(date.replaceAll('-','.'));
  await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeVisible();
  const clock=await page.getByTestId('clock').innerText();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(300);await expect(page.getByTestId('clock')).toHaveText(clock);await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeVisible();
});

test('日历允许两个完整年份，日期范围两端均可选择',async({page})=>{
  await page.goto('/');await ready(page);await datePanel(page);
  const date=page.getByRole('button',{name:'日期 1',exact:true}),max=(await date.getAttribute('data-max'))!,min=(await date.getAttribute('data-min'))!;
  await chooseDate(page,0,min);await expect(page.locator('.map-day')).toHaveText(min.replaceAll('-','.'));
  await date.click();await expect(page.getByRole('gridcell',{name:min,exact:true})).toHaveAttribute('aria-selected','true');
  const before=new Date(`${min}T12:00:00Z`);before.setUTCDate(before.getUTCDate()-1);
  await expect(page.getByRole('gridcell',{name:before.toISOString().slice(0,10),exact:true})).toHaveAttribute('aria-disabled','true');
  await page.keyboard.press('Escape');await chooseDate(page,0,max);await date.click();
  const after=new Date(`${max}T12:00:00Z`);after.setUTCDate(after.getUTCDate()+1);
  await expect(page.getByRole('gridcell',{name:after.toISOString().slice(0,10),exact:true})).toHaveAttribute('aria-disabled','true');
  await page.keyboard.press('Escape');await expect(date).toHaveAttribute('data-date',max);
});
test('首次图形初始化失败可重试恢复，再准备全国播放',async({page})=>{
  await page.addInitScript(()=>{
    (window as any).__denyWebGL=true;
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){
      if((window as any).__denyWebGL && (type==='webgl'||type==='webgl2'||type==='experimental-webgl'))return null;
      return (original as any).call(this,type,...args);
    } as typeof original;
  });
  await page.goto('/');await expect(page.locator('.map-error')).toBeVisible();
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeDisabled();
  await datePanel(page);await expect(page.locator('.term-button').first()).toBeDisabled();await closePanel(page);
  await page.evaluate(()=>{(window as any).__denyWebGL=false;});
  await page.locator('.map-error button').click();await ready(page);await expect(page.locator('.map-error')).toHaveCount(0);
});
test('主图和附图图形上下文丢失后重建并恢复绘制',async({page})=>{
  await page.goto('/');await ready(page);await page.waitForTimeout(300);
  const selectors=['.map-canvas canvas'];
  if(await page.locator('.inset-canvas canvas').count())selectors.push('.inset-canvas canvas');
  for(const selector of selectors){
    const original=await page.locator(selector).elementHandle();const lost=await original!.evaluate(canvas=>{const gl=(canvas as HTMLCanvasElement).getContext('webgl2');const e=gl?.getExtension('WEBGL_lose_context');if(!e)return false;e.loseContext();return true;});
    test.skip(!lost,'浏览器未提供上下文丢失测试扩展');await expect(page.locator('.map-error')).toBeVisible();await page.locator('.map-error button').click();await ready(page);
    expect(await original!.evaluate(canvas=>canvas.isConnected)).toBe(false);await expect(page.locator('.map-error')).toHaveCount(0);
  }
});
test('WebGL不可用时给出明确初始化错误和重试入口',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','初始化故障专项桌面验证');
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:unknown[]){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;return (original as any).call(this,type,...args);} as typeof original;});
  await page.goto('/');await expect(page.locator('.map-error')).toContainText('地图初始化失败');await expect(page.locator('.map-error button')).toHaveText('重试');
});

test('四季观测历完整，详情关闭不清除选区且可以重开',async({page},info)=>{
  await page.goto('/');await ready(page);await datePanel(page);
  await expect(page.locator('.season')).toHaveCount(4);
  for(const season of ['spring','summer','autumn','winter'])await expect(page.locator(`.season[data-season="${season}"] .term-button`)).toHaveCount(6);
  for(const date of await page.locator('.term-button small').allTextContents())expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await closePanel(page);await clickMap(page,[112.933419,28.23129]);
  await details(page);await expect(page.getByRole('heading',{name:'湖南省',exact:true})).toBeVisible();
  const before=await view(page);
  if(info.project.name==='desktop-chromium'){
    await page.getByRole('button',{name:'关闭地区详情',exact:true}).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button',{name:'地区详情',exact:true})).toBeFocused();
    await expect(page.getByRole('heading',{name:'湖南省',exact:true})).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button',{name:'关闭地区详情',exact:true})).toBeFocused();
  }else{await closePanel(page);await details(page);}
  await expect(page.getByRole('heading',{name:'湖南省',exact:true})).toBeVisible();
  const after=await view(page);expect(after.center).toEqual(before.center);expect(after.zoom).toBe(before.zoom);expect(after.maxZoom).toBe(before.maxZoom);
  await closePanel(page);await details(page);await page.getByRole('navigation',{name:'行政区路径'}).getByRole('button',{name:'全国',exact:true}).click();
  if(info.project.name==='desktop-chromium')await expect(page.locator('.details-card')).toHaveCount(0);
});

test('面板键盘关闭恢复焦点，减少动态效果仍可操作',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await ready(page);
  const motion=await page.locator('.map-workspace').evaluate(e=>getComputedStyle(e).animationName);expect(motion).toBe('none');
  const opener=page.getByRole('button',{name:'日期与节气',exact:true});
  if(info.project.name!=='desktop-chromium'){
    await opener.focus();await opener.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(opener).toBeFocused();
    await opener.press('Enter');await page.locator('.term-button').last().scrollIntoViewIfNeeded();
    await expect(page.getByRole('button',{name:'关闭面板',exact:true})).toBeInViewport();
    await page.getByRole('button',{name:'关闭面板',exact:true}).click();await expect(opener).toBeFocused();
  }
  await datePanel(page);await page.locator('.term-button').filter({hasText:'夏至'}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();await page.getByRole('button',{name:'暂停播放',exact:true}).click();
});


test('双图按地图容器宽度换向，窄桌面保留完整地图和工具留白',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','容器断点在桌面项目验证');
  await page.setViewportSize({width:1360,height:900});await page.goto('/');await ready(page);
  await page.getByRole('button',{name:'两天对比',exact:true}).click();await ready(page);
  await expect.poll(()=>page.locator('.maps').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
  await expect.poll(()=>page.locator('.map-pane').first().evaluate(e=>{
    const point=(e as any).__vueParentComponent.exposed.projectPoint([135.5,53]);
    return point.x<e.clientWidth-16;
  })).toBe(true);
  await page.setViewportSize({width:1200,height:720});
  await expect(page.locator('.atlas-app')).toHaveClass(/stacked-comparison/);
  await expect.poll(()=>page.locator('.maps').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(1);
  const second=page.locator('.map-pane').nth(1);await second.scrollIntoViewIfNeeded();
  const bounds=await second.boundingBox();expect(bounds!.height).toBeGreaterThanOrEqual(440);
  expect(await page.locator('.map-workspace').evaluate(e=>e.scrollHeight<=e.clientHeight)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
