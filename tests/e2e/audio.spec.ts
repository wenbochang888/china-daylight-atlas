import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { chooseDate } from '../helpers/date-picker';
import { combinePlaybackSegments, nationalPlaybackSegments, playbackElapsedSeconds, prepareNationalGeometry } from '../../src/domain/national-playback';

const pageErrors = new WeakMap<Page,string[]>();
const geometry = prepareNationalGeometry(JSON.parse(readFileSync('public/maps/provinces.json','utf8')));
function expectedSeconds(minute:number,dates=['2026-10-03']) {
  return playbackElapsedSeconds(minute,combinePlaybackSegments(dates.map(date=>nationalPlaybackSegments(date,geometry)))) % 265;
}
async function musicAt(page:Page,minute:number,dates=['2026-10-03']) {
  await expect.poll(async()=>Math.abs(await time(page)-expectedSeconds(minute,dates))).toBeLessThan(0.05);
}
test.beforeEach(async ({page}) => {
  const errors:string[]=[]; pageErrors.set(page,errors); page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-03T04:00:00Z'));
});
test.afterEach(({page}) => expect(pageErrors.get(page)).toEqual([]));
async function ready(page:Page) { await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({timeout:30000}); }
async function datePanel(page:Page) { const button=page.getByRole('button',{name:'日期与节气',exact:true}); if(await button.isVisible())await button.click(); }
async function closePanel(page:Page) { const button=page.getByRole('button',{name:'关闭面板',exact:true}); if(await button.isVisible())await button.click(); }
async function musicPlaying(page:Page) {
  await expect.poll(()=>page.locator('audio').evaluate((audio: HTMLAudioElement)=>!audio.paused && !audio.seeking && audio.readyState>=2 && audio.currentTime>0.15),{timeout:15000}).toBe(true);
}
async function time(page:Page) { return page.locator('audio').evaluate((audio: HTMLAudioElement)=>audio.currentTime); }

test('音乐选择可记忆，关闭状态播放地图不下载MP3，暂停时开启不发声',async({page})=>{
  const requests:string[]=[];page.on('request',r=>{if(r.url().endsWith('.mp3'))requests.push(r.url());});
  await page.goto('/');await ready(page);await expect(page.getByRole('button',{name:'关闭音乐',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'关闭音乐',exact:true}).click();
  await page.getByRole('button',{name:'开始播放',exact:true}).click();
  await expect.poll(async()=>Number(await page.getByRole('slider',{name:'北京时间时间轴'}).inputValue())).toBeGreaterThan(1);
  expect(requests).toEqual([]);expect(await page.locator('audio').evaluate((a:HTMLAudioElement)=>a.paused)).toBe(true);
  await page.reload();await ready(page);await expect(page.getByRole('button',{name:'开启音乐',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect(page.getByTestId('clock')).toHaveText('00:00');
  await page.getByRole('button',{name:'开启音乐',exact:true}).click();expect(requests).toEqual([]);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360');
  await page.getByRole('button',{name:'开始播放',exact:true}).click();await musicPlaying(page);
  expect(await time(page)).toBeGreaterThanOrEqual(expectedSeconds(360));
});

test('播放中关闭声音不暂停地图，重新开启对齐当前音乐位置，键盘可以切换',async({page})=>{
  await page.goto('/');await ready(page);await page.getByRole('button',{name:'开始播放',exact:true}).click();await musicPlaying(page);
  await page.getByRole('button',{name:'关闭音乐',exact:true}).click();
  const before=Number(await page.getByRole('slider',{name:'北京时间时间轴'}).inputValue());
  await expect.poll(async()=>Number(await page.getByRole('slider',{name:'北京时间时间轴'}).inputValue())).toBeGreaterThan(before+1);
  expect(await page.locator('audio').evaluate((a:HTMLAudioElement)=>a.paused)).toBe(true);
  await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('720');
  await page.getByRole('button',{name:'开始播放',exact:true}).click();
  const toggle=page.getByRole('button',{name:'开启音乐',exact:true});await toggle.focus();await toggle.press('Enter');await musicPlaying(page);
  const current=await page.evaluate(()=>({minute:Number((document.querySelector('input[type="range"]') as HTMLInputElement).value),seconds:(document.querySelector('audio') as HTMLAudioElement).currentTime}));
  expect(Math.abs(current.seconds-expectedSeconds(current.minute))).toBeLessThan(0.2);
  await page.getByRole('button',{name:'关闭音乐',exact:true}).focus();await page.keyboard.press('Space');
  expect(await page.locator('audio').evaluate((a:HTMLAudioElement)=>a.paused)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('本地存储被禁用时音乐开关仍可使用，关闭时隐藏故障提示',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});
    HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('blocked','NotAllowedError'));};
  });
  await page.goto('/');await ready(page);await page.getByRole('button',{name:'开始播放',exact:true}).click();
  await expect(page.locator('.audio-notice')).toBeVisible();await page.getByRole('button',{name:'关闭音乐',exact:true}).click();
  await expect(page.locator('.audio-notice')).toHaveCount(0);await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'开启音乐',exact:true}).click();await expect(page.locator('.audio-notice')).toBeVisible();
});

test('初始不下载音乐，播放暂停续播及时间轴操作联动唯一音频',async({page})=>{
  const requests:string[]=[]; page.on('request',request=>{if(request.url().endsWith('.mp3'))requests.push(request.url());});
  await page.goto('/'); await ready(page);
  const audio=page.locator('audio'); await expect(audio).toHaveCount(1);
  expect(await audio.evaluate((element: HTMLAudioElement)=>({paused:element.paused,time:element.currentTime,loop:element.loop,preload:element.preload,rate:element.playbackRate})))
    .toEqual({paused:true,time:0,loop:true,preload:'none',rate:1});
  expect(requests).toEqual([]);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('0');
  await page.getByRole('button',{name:'开始播放',exact:true}).click(); await musicPlaying(page);
  expect(decodeURIComponent(await audio.getAttribute('src') ?? '')).toContain('钢琴曲');
  expect(await audio.evaluate((element: HTMLAudioElement)=>element.duration)).toBeCloseTo(265,0);
  await page.getByRole('button',{name:'暂停播放',exact:true}).click(); const paused=await time(page);
  await page.waitForTimeout(350); expect(await time(page)).toBeCloseTo(paused,1);
  expect(await audio.evaluate((element: HTMLAudioElement)=>element.paused)).toBe(true);
  await page.getByRole('button',{name:'开始播放',exact:true}).click();
  await expect.poll(()=>time(page)).toBeGreaterThan(paused+0.15);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360');
  await expect(page.getByTestId('clock')).toHaveText('06:00'); expect(await audio.evaluate((element: HTMLAudioElement)=>element.paused)).toBe(true);
  await musicAt(page,360); expect(await time(page)).toBeCloseTo(10.707933213975695,2);
  expect(requests.every(url=>decodeURIComponent(url).includes('钢琴曲'))).toBe(true);
  await page.getByRole('button',{name:'开始播放',exact:true}).click(); await musicPlaying(page);
  await expect.poll(()=>time(page)).toBeGreaterThan(10.857933213975695);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('0'); await musicAt(page,0);
  expect(await audio.evaluate((element: HTMLAudioElement)=>element.paused)).toBe(true);
});

test('首次从06:00开始，元数据加载后定位到对应音乐位置',async({page})=>{
  await page.goto('/'); await ready(page); await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360');
  expect(await time(page)).toBe(0);
  await page.getByRole('button',{name:'开始播放',exact:true}).click(); await musicPlaying(page);
  expect(await time(page)).toBeGreaterThanOrEqual(10.707933213975695);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360'); await musicAt(page,360);
});

test('真实MP3到结尾后循环，地图时刻继续推进，音频保持正常速度',async({page})=>{
  await page.goto('/'); await ready(page); await page.getByRole('slider',{name:'北京时间时间轴'}).fill('0');
  await page.getByRole('button',{name:'开始播放',exact:true}).click(); await musicPlaying(page);
  const before=Number(await page.getByRole('slider',{name:'北京时间时间轴'}).inputValue());
  await page.locator('audio').evaluate((audio: HTMLAudioElement)=>{audio.currentTime=audio.duration-0.35;});
  await expect.poll(()=>time(page),{timeout:10000}).toBeLessThan(3); await musicPlaying(page);
  expect(Number(await page.getByRole('slider',{name:'北京时间时间轴'}).inputValue())).toBeGreaterThan(before);
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement)=>({paused:audio.paused,rate:audio.playbackRate,loop:audio.loop}))).toEqual({paused:false,rate:1,loop:true});
});

test('换日及单双图按当前时刻重新定位音乐，节气从头联动唯一音频',async({page})=>{
  await page.goto('/'); await ready(page); await page.getByRole('button',{name:'开始播放',exact:true}).click(); await musicPlaying(page);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360'); await musicAt(page,360);
  await datePanel(page); await chooseDate(page,0,'2026-10-02');
  await musicAt(page,360,['2026-10-02']); expect(await page.locator('audio').evaluate((audio: HTMLAudioElement)=>audio.paused)).toBe(true);
  await closePanel(page); await ready(page); await datePanel(page);
  const term=page.locator('.term-button').filter({hasText:'夏至'}),termDate=await term.locator('small').innerText();
  await term.click();
  await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  await expect.poll(async()=>await page.locator('audio').evaluate((audio: HTMLAudioElement)=>!audio.paused) || await page.locator('.audio-notice').isVisible(),{timeout:15000}).toBe(true);
  if(await page.locator('.audio-notice').isVisible())await page.getByRole('button',{name:'重试音乐',exact:true}).click();
  await musicPlaying(page); expect(await time(page)).toBeLessThan(5);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360'); await musicAt(page,360,[termDate]);
  await datePanel(page); await page.getByRole('button',{name:'两天对比',exact:true}).click(); await closePanel(page); await ready(page);
  await expect(page.locator('audio')).toHaveCount(1); await expect(page.locator('.map-pane')).toHaveCount(2);
  const comparisonDates=(await page.locator('.map-day').allTextContents()).map(date=>date.replaceAll('.','-'));
  await musicAt(page,360,comparisonDates);
  const paused=await time(page); expect(await page.locator('audio').evaluate((audio: HTMLAudioElement)=>audio.paused)).toBe(true);
  await page.getByRole('button',{name:'开始播放',exact:true}).click(); await expect.poll(()=>time(page)).toBeGreaterThan(paused+0.15);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360');
  await datePanel(page); await page.getByRole('button',{name:'退出对比',exact:true}).click(); await closePanel(page);
  await expect(page.locator('audio')).toHaveCount(1); await musicAt(page,360,[termDate]);
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement)=>audio.paused)).toBe(true);
});

test('后台暂停并保留音乐进度，返回后不自动恢复',async({page})=>{
  await page.goto('/'); await ready(page); await page.getByRole('button',{name:'开始播放',exact:true}).click(); await musicPlaying(page);
  const paused=await page.locator('audio').evaluate(async (audio: HTMLAudioElement)=>{
    const stopped=new Promise<void>(resolve=>audio.addEventListener('pause',()=>resolve(),{once:true}));
    Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
    await stopped;return audio.currentTime;
  });
  await expect(page.getByRole('button',{name:'开始播放',exact:true})).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(350); expect(await time(page)).toBeCloseTo(paused,1); expect(await page.locator('audio').evaluate((audio: HTMLAudioElement)=>audio.paused)).toBe(true);
  await page.getByRole('button',{name:'开始播放',exact:true}).click(); await expect.poll(()=>time(page)).toBeGreaterThan(paused+0.15);
});

test('日终音乐停止，同日重播从音乐开头开始',async({page})=>{
  await page.goto('/'); await ready(page); const date=await page.locator('.map-day').innerText();
  await page.getByRole('button',{name:'开始播放',exact:true}).click(); await musicPlaying(page);
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('1439'); await page.getByRole('button',{name:'开始播放',exact:true}).click();
  await expect(page.getByTestId('clock')).toHaveText('24:00'); expect(await page.locator('audio').evaluate((audio: HTMLAudioElement)=>audio.paused)).toBe(true);
  await musicAt(page,1440);
  await page.getByRole('button',{name:'开始播放',exact:true}).click(); await musicPlaying(page);
  expect(await time(page)).toBeLessThan(3); await expect(page.locator('.map-day')).toHaveText(date);
  expect(Number(await page.getByRole('slider',{name:'北京时间时间轴'}).inputValue())).toBeLessThan(300);
});

test('音乐请求失败不阻塞地图，恢复资源后重试成功',async({page})=>{
  await page.route('**/*.mp3',route=>route.abort()); await page.goto('/'); await ready(page);
  await page.getByRole('button',{name:'开始播放',exact:true}).click(); await expect(page.locator('.audio-notice')).toBeVisible();
  await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  const before=Number(await page.getByRole('slider',{name:'北京时间时间轴'}).inputValue());
  await expect.poll(async()=>Number(await page.getByRole('slider',{name:'北京时间时间轴'}).inputValue())).toBeGreaterThan(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'暂停播放',exact:true}).click(); await expect(page.getByRole('button',{name:'重试音乐',exact:true})).toBeDisabled();
  await page.getByRole('slider',{name:'北京时间时间轴'}).fill('360');
  await page.getByRole('button',{name:'开始播放',exact:true}).click();
  await expect.poll(()=>page.locator('audio').evaluate((audio: HTMLAudioElement)=>audio.error !== null)).toBe(true);
  await page.unroute('**/*.mp3'); await page.getByRole('button',{name:'重试音乐',exact:true}).click();
  await musicPlaying(page); await expect(page.locator('.audio-notice')).toHaveCount(0);
  expect(await time(page)).toBeGreaterThanOrEqual(10.707933213975695);
});

test('浏览器拒绝声音时地图继续，用户点击重试音乐恢复声音',async({page})=>{
  await page.addInitScript(()=>{
    const original=HTMLMediaElement.prototype.play; let blocked=true;
    HTMLMediaElement.prototype.play=function(){
      if(this instanceof HTMLAudioElement && blocked){blocked=false;return Promise.reject(new DOMException('blocked','NotAllowedError'));}
      return original.call(this);
    };
  });
  await page.goto('/'); await ready(page); await page.getByRole('button',{name:'开始播放',exact:true}).click();
  await expect(page.locator('.audio-notice')).toContainText('未能自动播放'); await expect(page.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible();
  const before=Number(await page.getByRole('slider',{name:'北京时间时间轴'}).inputValue());
  await page.getByRole('button',{name:'重试音乐',exact:true}).click(); await musicPlaying(page); await expect(page.locator('.audio-notice')).toHaveCount(0);
  expect(Number(await page.getByRole('slider',{name:'北京时间时间轴'}).inputValue())).toBeGreaterThan(before);
});
