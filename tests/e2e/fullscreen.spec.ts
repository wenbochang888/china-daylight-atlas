import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const output='docs/validation-images/map-labels-terms';
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',error=>list.push(error.message));});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
async function ready(page:Page){await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});}
async function counts(page:Page){return page.locator('.map-pane').evaluateAll(elements=>elements.map(e=>{
  const exposed=(e as any).__vueParentComponent.exposed;
  return exposed.isLoaded()?new Set(exposed.getProvinceLabels()).size:0;
}));}
async function compare(page:Page){
  const opener=page.getByRole('button',{name:'日期与节气',exact:true});if(await opener.isVisible())await opener.click();
  await page.getByRole('button',{name:'两天对比',exact:true}).click();
  const close=page.getByRole('button',{name:'关闭面板',exact:true});if(await close.isVisible())await close.click();
  await ready(page);
}
async function fallback(page:Page){await page.addInitScript(()=>{Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{configurable:true,value:undefined});});}
async function geometry(page:Page){
  return page.evaluate(()=>{
    const rect=(selector:string)=>{const b=document.querySelector(selector)!.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
    const maps=document.querySelector('.maps')!;
    return {viewport:{width:innerWidth,height:innerHeight},workspace:rect('.map-workspace'),canvas:rect('.map-canvas'),pane:rect('.map-pane'),
      columns:getComputedStyle(maps).gridTemplateColumns.split(' ').length,
      scroll:maps.scrollHeight>maps.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth};
  });
}
async function screenshot(page:Page,name:string){
  mkdirSync(output,{recursive:true});await expect.poll(()=>counts(page)).toEqual(Array(await page.locator('.map-pane').count()).fill(34));
  // Wait for the final label-placement render, after the ResizeObserver camera fit.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:`${output}/${name}.png`,fullPage:!await page.locator('.atlas-app').evaluate(e=>e.classList.contains('immersive'))});
}

test('手机移除附图和留白，三个图层使用简称且仍打开完整省名详情',async({page},info)=>{
  await page.goto('/');await ready(page);await expect.poll(()=>counts(page)).toEqual([34]);
  const mobile=await page.locator('.atlas-app').evaluate(e=>e.classList.contains('mobile-presentation'));
  await expect(page.locator('.inset-canvas canvas')).toHaveCount(mobile?0:1);
  await screenshot(page,`${info.project.name}-normal-midnight`);
  const styles=await page.locator('.map-pane').evaluate(e=>(e as any).__vueParentComponent.exposed.getProvinceLabelStyles());
  if(mobile)for(const style of styles){expect(style.text).toEqual(['get','shortName']);expect(style.size).toBe(12);}
  else expect(styles[0].text).toEqual(['get','name']);
  // Desktop has special names for Hong Kong/Macao and Taiwan; check its ordinary layer separately.
  if(mobile){const g=await geometry(page);expect(g.canvas.height).toBeCloseTo(g.pane.height,0);expect(g.pane.height).toBeGreaterThanOrEqual(420);}
  for(const [id,name] of [['156440000','广东省'],['156110000','北京市'],['156810000','香港特别行政区']]){
    const point=await page.locator('.map-pane').evaluate((e,id)=>(e as any).__vueParentComponent.exposed.getProvinceLabelPoint(id),id);
    await page.locator('.map-canvas').click({position:point});await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
    const close=page.getByRole('button',{name:mobile?'关闭面板':'关闭地区详情',exact:true});
    if(await close.isVisible())await close.click();else await page.getByRole('button',{name:'关闭面板',exact:true}).click();
  }
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('720');await screenshot(page,`${info.project.name}-normal-noon`);
});

test('全屏备用模式只显示地图与最少操作，退出保持暂停、画布、音频、滚动和焦点',async({page},info)=>{
  await fallback(page);await page.goto('/');await ready(page);
  const slider=page.getByRole('slider',{name:'北京时间时间轴'});await slider.fill('1146');
  const date=await page.locator('.map-day').innerText(),canvas=await page.locator('.map-canvas canvas').elementHandle(),audio=await page.locator('audio').elementHandle();
  await page.evaluate(()=>{window.scrollTo(0,100);const workspace=document.querySelector('.map-workspace')!;workspace.scrollTop=80;});
  const scroll=await page.evaluate(()=>({y:scrollY,inner:document.querySelector('.map-workspace')!.scrollTop}));
  await page.getByRole('button',{name:'全屏查看地图',exact:true}).click();
  await expect(page.locator('.map-workspace')).toHaveAttribute('data-fullscreen','viewport');
  await expect(page.locator('.map-toolbar')).not.toBeVisible();await expect(slider).not.toBeVisible();
  await expect(page.locator('.map-footer')).not.toBeVisible();await expect(page.getByRole('button',{name:'退出全屏',exact:true})).toBeFocused();
  await expect(page.getByTestId('map-clock')).toHaveText('19:06');await expect(page.locator('.map-day')).toHaveText(date);
  const g=await geometry(page);expect(g.workspace.x).toBe(0);expect(g.workspace.y).toBe(0);
  expect(g.workspace.width).toBe(g.viewport.width);expect(g.workspace.height).toBe(g.viewport.height);expect(g.scroll||g.overflow).toBe(false);
  const point=await page.locator('.map-pane').evaluate(e=>(e as any).__vueParentComponent.exposed.getProvinceLabelPoint('156430000'));
  await page.locator('.map-canvas').click({position:point});await expect(page.locator('dialog[open],.details-card')).toHaveCount(0);
  await screenshot(page,`${info.project.name}-fullscreen-transition`);
  await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'退出全屏',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('.map-workspace')).toHaveAttribute('data-fullscreen','none');
  await expect(page.getByRole('button',{name:'全屏查看地图',exact:true})).toBeFocused();await expect(slider).toHaveValue('1146');
  expect(await canvas!.evaluate(e=>e===document.querySelector('.map-canvas canvas'))).toBe(true);
  expect(await audio!.evaluate(e=>e===document.querySelector('audio'))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>({y:scrollY,inner:document.querySelector('.map-workspace')!.scrollTop}))).toEqual(scroll);
  expect(await page.locator('body').evaluate(e=>e.style.position)).toBe('');
});

test('全屏切换不停止共享播放和音乐，24点停止后可以从同日零点重播',async({page})=>{
  await fallback(page);await page.goto('/');await ready(page);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360');
  await page.getByRole('button',{name:'开始播放',exact:true}).click();
  await expect.poll(()=>page.locator('audio').evaluate((e:HTMLAudioElement)=>!e.paused)).toBe(true);
  const audio=await page.locator('audio').elementHandle();
  await page.getByRole('button',{name:'全屏查看地图',exact:true}).click();
  await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  expect(await audio!.evaluate((e:HTMLAudioElement)=>!e.paused&&e.playbackRate===1)).toBe(true);
  const before=await page.getByTestId('map-clock').innerText();
  await expect.poll(()=>page.getByTestId('map-clock').innerText()).not.toBe(before);
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();
  await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  expect(await audio!.evaluate((e:HTMLAudioElement)=>!e.paused&&e===document.querySelector('audio'))).toBe(true);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('1439');const date=await page.locator('.map-day').innerText();
  await page.getByRole('button',{name:'全屏查看地图',exact:true}).click();await page.getByRole('button',{name:'开始播放',exact:true}).click();
  await expect(page.getByTestId('map-clock')).toHaveText('24:00');await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeVisible();
  expect(await audio!.evaluate((e:HTMLAudioElement)=>e.paused)).toBe(true);
  await page.getByRole('button',{name:'开始播放',exact:true}).click();await page.getByRole('button',{name:'暂停播放',exact:true}).click();
  // 全夜阶段每秒推进90分钟，两次点击之间可能已经跨过00点时段。
  expect(Number(await page.getByRole('slider',{name:'北京时间时间轴',includeHidden:true}).inputValue())).toBeLessThan(300);await expect(page.locator('.map-day')).toHaveText(date);
});

test('双图全屏均分空间，旋转后重新拟合且保留34个省名和主画布',async({page},info)=>{
  await fallback(page);await page.goto('/');await ready(page);await compare(page);
  const original=await page.locator('.map-canvas canvas').elementHandles();
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360');
  await page.getByRole('button',{name:'全屏查看地图',exact:true}).click();
  await expect.poll(()=>counts(page)).toEqual([34,34]);
  const assertLayout=async()=>{
    const g=await geometry(page);expect(g.columns).toBe(g.viewport.width>g.viewport.height?2:1);expect(g.scroll||g.overflow).toBe(false);
    for(const pane of await page.locator('.map-pane').all()){
      const b=(await pane.boundingBox())!;expect(b.y+b.height).toBeLessThanOrEqual(g.viewport.height+1);expect(b.x+b.width).toBeLessThanOrEqual(g.viewport.width+1);
    }
    await expect.poll(()=>counts(page)).toEqual([34,34]);
  };
  await assertLayout();await screenshot(page,`${info.project.name}-fullscreen-compare`);
  await page.setViewportSize({width:390,height:844});await assertLayout();
  await page.setViewportSize({width:844,height:390});await assertLayout();
  if(info.project.name.includes('mobile')){await expect(page.locator('.south-sea')).toHaveCount(0);await screenshot(page,`${info.project.name}-landscape-compare`);}
  for(let i=0;i<2;i++)expect(await original[i].evaluate((e,i)=>e===document.querySelectorAll('.map-canvas canvas')[i],i)).toBe(true);
  await expect(page.getByTestId('map-clock')).toHaveText(['06:00','06:00']);
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();await expect(page.getByTestId('clock')).toHaveText('06:00');
});

test('600px边界附图按需释放和创建，不重建主图或重置时间',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','桌面视口断点专项');
  await page.setViewportSize({width:601,height:900});await page.goto('/');await ready(page);
  const main=await page.locator('.map-canvas canvas').elementHandle();await page.getByRole('slider',{name:'北京时间时间轴'}).fill('720');
  await expect(page.locator('.inset-canvas canvas')).toHaveCount(1);
  await page.setViewportSize({width:600,height:900});await expect(page.locator('.south-sea')).toHaveCount(0);await expect.poll(()=>counts(page)).toEqual([34]);
  await page.setViewportSize({width:599,height:900});await expect(page.locator('.south-sea')).toHaveCount(0);
  await page.setViewportSize({width:601,height:900});await expect(page.locator('.inset-canvas canvas')).toHaveCount(1);
  await expect.poll(()=>page.locator('.map-pane').evaluate(e=>(e as any).__vueParentComponent.exposed.getInsetLabels().length)).toBeGreaterThanOrEqual(6);
  expect(await main!.evaluate(e=>e===document.querySelector('.map-canvas canvas'))).toBe(true);await expect(page.getByTestId('clock')).toHaveText('12:00');
});

test('原生全屏与浏览器主动退出同步布局和焦点',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','原生接口在桌面Chromium验证');
  await page.goto('/');await ready(page);await page.getByRole('button',{name:'全屏查看地图',exact:true}).click();
  await expect(page.locator('.map-workspace')).toHaveAttribute('data-fullscreen','native');
  expect(await page.evaluate(()=>document.fullscreenElement===document.querySelector('.map-workspace'))).toBe(true);
  await page.evaluate(()=>document.exitFullscreen());await expect(page.locator('.map-workspace')).toHaveAttribute('data-fullscreen','none');
  await expect(page.getByRole('button',{name:'全屏查看地图',exact:true})).toBeFocused();
});

test('原生请求拒绝时仍可正常进入和退出备用模式',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(document,'fullscreenEnabled',{configurable:true,value:true});
    HTMLElement.prototype.requestFullscreen=()=>Promise.reject(new DOMException('denied','NotAllowedError'));
  });
  await page.goto('/');await ready(page);await page.getByRole('button',{name:'全屏查看地图',exact:true}).click();
  await expect(page.locator('.map-workspace')).toHaveAttribute('data-fullscreen','viewport');
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();await expect(page.locator('.map-workspace')).toHaveAttribute('data-fullscreen','none');
});

test('退出后的迟到原生成功不会重开全屏，后续请求仍可使用',async({page})=>{
  await page.addInitScript(()=>{
    let current:Element|null=null;
    Object.defineProperty(document,'fullscreenEnabled',{configurable:true,value:true});
    Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>current});
    HTMLElement.prototype.requestFullscreen=function(){return new Promise<void>(resolve=>{
      (window as any).__resolveFullscreen=()=>{current=this;document.dispatchEvent(new Event('fullscreenchange'));resolve();};
    });};
    document.exitFullscreen=()=>{current=null;document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve();};
  });
  await page.goto('/');await ready(page);await page.getByRole('button',{name:'全屏查看地图',exact:true}).click();
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();await page.evaluate(()=>(window as any).__resolveFullscreen());
  await expect(page.locator('.map-workspace')).toHaveAttribute('data-fullscreen','none');expect(await page.evaluate(()=>document.fullscreenElement)).toBeNull();
  await page.getByRole('button',{name:'全屏查看地图',exact:true}).click();await page.evaluate(()=>(window as any).__resolveFullscreen());
  await expect(page.locator('.map-workspace')).toHaveAttribute('data-fullscreen','native');
  await page.getByRole('button',{name:'退出全屏',exact:true}).click();await expect(page.locator('.map-workspace')).toHaveAttribute('data-fullscreen','none');
});
