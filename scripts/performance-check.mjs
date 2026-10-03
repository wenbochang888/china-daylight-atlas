import { chromium, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const fullChromium=process.argv.includes('--full-chromium');
const quick=process.argv.includes('--quick'),seconds=quick?30:60,rounds=quick?1:10;
let browser;
try{
  browser=await chromium.launch({headless:true,channel:fullChromium?'chromium':undefined,args:['--enable-precise-memory-info','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),requests=[],errors=[];
  page.on('request',r=>{if(r.url().includes('/maps/'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173');await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000});
  await page.getByRole('button',{name:'两天对比',exact:true}).click();
  await expect(page.getByText('正在准备地图…')).toHaveCount(0,{timeout:30000});
  await page.locator('.term-button').filter({hasText:'夏至'}).click();await page.getByRole('button',{name:'暂停播放',exact:true}).click();
  await page.getByRole('button',{name:'节气应用于日期 2',exact:true}).click();
  await page.locator('.term-button').filter({hasText:'冬至'}).click();
  await page.waitForTimeout(500);const beforeRequests=requests.length;
  const before=await page.evaluate(()=>{const gl=document.querySelector('.map-canvas canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return{memoryBytes:performance.memory?.usedJSHeapSize,renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'not exposed',userAgent:navigator.userAgent};});
  // Headless automation avoids accidental closure of a desktop browser window.
  // The product stops at 24:00. This test harness starts another cycle via the visible button.
  let restarts=0,stopping=false,polling=false;
  const restartTimer=setInterval(async()=>{if(polling||stopping)return;polling=true;try{
    if(await page.getByTestId('clock').innerText()==='24:00' && await page.getByRole('button',{name:'开始播放',exact:true}).isEnabled()){
      await page.getByRole('button',{name:'开始播放',exact:true}).click();restarts++;
    }
  }catch(e){errors.push(String(e));}finally{polling=false;}},250);
  const windows=[];console.log(JSON.stringify({before}));
  try{
    for(let i=0;i<rounds;i++){
      await page.bringToFront();
      const measurement=await page.evaluate(async seconds=>{
        const intervals=[];let previous=performance.now();const start=previous;
        await new Promise(resolve=>{function frame(now){intervals.push(now-previous);previous=now;if(now-start>=seconds*1000)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
        intervals.sort((a,b)=>a-b);return{frames:intervals.length,p95FrameMs:intervals[Math.floor(intervals.length*.95)],heapBytes:performance.memory?.usedJSHeapSize};
      },seconds);
      const scene=await page.evaluate(()=>({documentHidden:document.hidden,dates:[...document.querySelectorAll('.map-day')].map(e=>e.textContent),time:document.querySelector('[data-testid="clock"]').textContent,playing:!!document.querySelector('button[aria-label="暂停播放"]'),levels:[...document.querySelectorAll('.level-chip')].map(e=>e.textContent),viewports:[...document.querySelectorAll('.map-canvas')].map(e=>({width:e.clientWidth,height:e.clientHeight}))}));
      windows.push({...measurement,scene});console.log(JSON.stringify({window:i+1,...measurement,scene,restarts}));
    }
  }finally{stopping=true;clearInterval(restartTimer);}
  const pause=page.getByRole('button',{name:'暂停播放',exact:true});if(await pause.isVisible())await pause.click();
  const result={browserMode:fullChromium?'full Chromium, headless':'Chromium headless shell',before,windows,seconds:rounds*seconds,restarts,mode:'two dates (summer/winter), national view, automatic 60/10 minutes/second; harness restarts only at 24:00',url:'http://127.0.0.1:4173',newMapRequestsDuringPlayback:requests.length-beforeRequests,mapRequestsDuringPlayback:requests.slice(beforeRequests),errors:[...errors,...await page.locator('.map-error').allTextContents()]};
  writeFileSync(`docs/validation-images/observatory/performance${fullChromium?'-chromium':''}${quick?'-quick':''}.json`,JSON.stringify(result,null,2));console.log('Playback check completed.');
}finally{await browser?.close();}
