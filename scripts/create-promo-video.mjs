import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const output = resolve('docs/promo-video');
const work = '/private/tmp/china-daylight-promo';
const frames = join(work, 'frames');
const plan = JSON.parse(readFileSync(join(output, 'storyboard.json'), 'utf8'));
const fps = plan.captureFps;
const resumeComparison = process.argv.includes('--resume-comparison');
mkdirSync(frames, { recursive: true });
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const probe = path => JSON.parse(run('ffprobe', ['-v','error','-show_format','-show_streams','-of','json',path]));
const stamp = seconds => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;
};
const captions = plan.scenes.flatMap(scene => scene.subtitle);
writeFileSync(join(output, '中国昼夜地图.srt'), captions.map(([start,end,text],i) => `${i+1}\n${stamp(start)} --> ${stamp(end)}\n${text}\n`).join('\n'));
const voices = [];
for (const [i,scene] of plan.scenes.entries()) {
  const path = join(work, `voice-${i}.aiff`);
  if (!process.argv.includes('--assemble-only') && !resumeComparison) run('say', ['-v','Tingting','-r',String(scene.rate),'-o',path,scene.voice]);
  const duration = Number(probe(path).format.duration);
  if (!duration || scene.voiceStart + duration > scene.end - .05) throw new Error(`镜头${i+1}旁白越界：${duration}s`);
  voices.push({ path, start:scene.voiceStart, duration });
}
writeFileSync(join(output, '旁白.txt'), plan.scenes.map((s,i)=>`${i+1}. ${s.start}—${s.end}秒\n${s.voice}`).join('\n\n'));
console.log('中文旁白准备完成', voices.map(v=>v.duration.toFixed(2)));

if (!process.argv.includes('--assemble-only')) {
  const browser = await chromium.launch({ args:['--force-color-profile=srgb'] });
  try {
    const page = await browser.newPage({ viewport:{ width:1920, height:1080 }, deviceScaleFactor:1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5178');
    await page.setContent(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#f4f8fa;color:#173c59;font-family:'PingFang SC',sans-serif}
      .top{height:104px;padding:0 92px;display:flex;align-items:center;justify-content:space-between}
      .title{font-size:34px;font-weight:600;letter-spacing:2px}.meta{font-size:18px;color:#527180;letter-spacing:3px}
      .sun{display:inline-block;width:17px;height:17px;border-radius:50%;background:#ffd56a;margin-right:18px;box-shadow:0 0 0 6px #ffd56a26}
      .frame{position:absolute;left:80px;top:104px;width:1760px;height:842px;overflow:hidden;border-radius:20px;box-shadow:0 12px 44px #173c5910}
      iframe{border:0;width:1760px;height:842px;display:block;background:#f4f8fa}
      .caption{position:absolute;left:80px;right:80px;top:970px;height:76px;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:500;letter-spacing:1px}
      .line{position:absolute;left:80px;right:80px;top:1065px;height:3px;background:#dbe5e9}.progress{height:3px;background:#80c7b2;width:0}
      .badge{position:absolute;left:116px;top:280px;padding:9px 15px;border-radius:6px;background:#fffef1ee;color:#315e68;font-size:18px;display:none}
      .tag{position:absolute;top:270px;color:#173c59;background:#fffefaee;border:1px solid #dbe5e9;border-radius:8px;padding:8px 16px;font-size:20px;display:none}
      #summer{left:130px}#winter{left:836px}
      .pointer{position:absolute;left:0;top:0;width:28px;height:36px;z-index:8;display:none;filter:drop-shadow(0 2px 2px #173c5940);pointer-events:none}
      .ring{position:absolute;width:44px;height:44px;margin:-22px;border:3px solid #c88a27;border-radius:50%;display:none;pointer-events:none;z-index:7}
      .highlight{position:absolute;display:none;border:3px solid #c88a27;border-radius:10px;box-shadow:0 0 0 5px #ffd56a35;pointer-events:none;z-index:5}
      .end{position:absolute;left:1522px;top:132px;width:304px;height:796px;background:#173c59;border-radius:12px;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:30px;opacity:0;pointer-events:none;z-index:6}
      .end .small{font-size:17px;color:#b8d3df;letter-spacing:3px;margin-bottom:28px}.end h2{font-family:'Songti SC',serif;font-size:43px;line-height:1.42;margin:0 0 30px;color:#ffd56a}.end p{font-size:21px;line-height:1.8;margin:0}.end .url{margin-top:50px;font-size:19px;color:#ffd56a;word-break:break-all;line-height:1.7}.end .open{margin-top:12px;font-size:16px;color:#b8d3df}
      .cover-title{font-family:'Songti SC',serif;font-size:54px;font-weight:600;letter-spacing:4px}
    </style><div class="top"><div class="title"><i class="sun"></i><span id="title"></span></div><div class="meta">日光观测台 · 北京时间 UTC+8</div></div>
    <div class="frame"><iframe id="product" src="http://127.0.0.1:5178/"></iframe></div>
    <div class="caption" id="caption"></div><div class="line"><div class="progress" id="progress"></div></div>
    <div class="badge" id="badge">演示加速</div><div class="tag" id="summer">夏至 · 2026.06.21</div><div class="tag" id="winter">冬至 · 2026.12.22</div>
    <svg class="pointer" id="pointer" viewBox="0 0 28 36"><path d="M2 2 L3 29 L10 22 L16 34 L22 31 L16 20 L26 20 Z" fill="#ffd56a" stroke="#173c59" stroke-width="2"/></svg>
    <div class="ring" id="ring"></div><div class="highlight" id="highlight"></div>
    <div class="end" id="end"><div class="small">日光观测台</div><h2>中国<br>昼夜地图</h2><p>选一天，<br>看光影如何<br>走过中国。</p><div class="url">www.gdufe888.top/sun/</div><div class="open">打开浏览器，即可体验</div></div></html>`);
    const app = page.frames().find(f=>f.parentFrame());
    await expect(app.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled({ timeout:60000 });
    await app.locator('.atlas-app').evaluate((e,resume) => { const s=e.__vueParentComponent.setupState; s.musicEnabled=false; s.setDate(0,resume?'2026-06-21':'2026-10-03'); s.seekMinute(1080); },resumeComparison);
    await expect(app.getByRole('button',{name:'开始播放',exact:true})).toBeEnabled();
    await page.waitForTimeout(500);
    // Keep playback time independent of screenshot encoding time. The product still
    // computes all positions and vectors; each captured frame advances a fixed clock.
    await app.evaluate(()=>{
      const frame=window.requestAnimationFrame.bind(window);
      window.__promoNativeNow=performance.now.bind(performance);
      window.__promoClock=performance.now();
      window.__promoLive=false;
      window.__promoLiveStart=window.__promoNativeNow();
      Object.defineProperty(performance,'now',{value:()=>window.__promoClock+(window.__promoLive?window.__promoNativeNow()-window.__promoLiveStart:0)});
      window.requestAnimationFrame=callback=>frame(()=>callback(performance.now()));
    });
    const clockOrigin=await app.evaluate(()=>window.__promoClock);
    const setMinute = async minute => {
      await app.locator('.atlas-app').evaluate((e,minute) => { e.__vueParentComponent.setupState.minute=minute; }, minute);
      await app.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    };
    const settle = async () => {
      await expect(app.getByRole('slider',{name:'北京时间时间轴'})).toBeEnabled({timeout:60000});
      await app.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    };
    const seek = async minute => { await app.getByRole('slider',{name:'北京时间时间轴'}).fill(String(minute)); await settle(); };
    const term = async name => {
      const button=app.locator('.term-button').filter({hasText:name});
      await button.scrollIntoViewIfNeeded(); await button.click();
      await expect(app.getByRole('button',{name:'暂停播放',exact:true})).toBeVisible({timeout:60000});
    };
    const pause = async () => { await app.locator('.atlas-app').evaluate(e=>e.__vueParentComponent.setupState.pause()); };
    const buttonPoint = async locator => { const b=await locator.boundingBox(); return {x:b.x+b.width/2,y:b.y+b.height/2}; };
    const checks=resumeComparison?JSON.parse(readFileSync(join(output,'capture-check.json'),'utf8')).checks.filter(c=>c.scene<=5):[];
    let sliderBox, summerPoint, provincePoint, detailsBox;
    for (let n=0;n<plan.duration*fps;n++) {
      const t=n/fps, scene=plan.scenes.findIndex(s=>t>=s.start&&t<s.end);
      const local=t-plan.scenes[scene].start;
      if(resumeComparison&&t<35)continue;
      await app.evaluate(time=>{window.__promoClock=time;},clockOrigin+t*1000);
      if (n===11*fps) { await seek(270); await app.getByRole('button',{name:'开始播放',exact:true}).click(); }
      if (n===21*fps) {
        await pause(); await seek(1020);
        sliderBox=await app.getByRole('slider',{name:'北京时间时间轴'}).boundingBox();
      }
      if (n===28*fps) {
        await page.mouse.up();
        await pause(); await seek(420);
        await app.locator('.observation-scroll').evaluate(e=>{e.scrollTop=150;});
        summerPoint=await buttonPoint(app.locator('.term-button').filter({hasText:'夏至'}));
      }
      if (n===Math.round(30.5*fps)) { await term('夏至'); await setMinute(0); }
      if (n===35*fps) {
        // New MapLibre instances need their real load/transition clock until ready.
        await app.evaluate(()=>{window.__promoLive=true;window.__promoLiveStart=window.__promoNativeNow();});
        await pause(); await app.getByRole('button',{name:'两天对比',exact:true}).click(); await settle();
        await app.getByRole('button',{name:'节气应用于日期 2',exact:true}).click(); await term('冬至'); await pause(); await seek(420);
        await app.evaluate(()=>{window.__promoLive=false;});
      }
      if (n===47*fps) {
        await app.getByRole('button',{name:'退出对比',exact:true}).click(); await settle(); await seek(720);
        await page.waitForTimeout(500);
        const point=await app.locator('.map-pane').first().evaluate(e=>e.__vueParentComponent.exposed.getProvinceLabelPoint('156430000'));
        const b=await app.locator('.map-canvas').first().boundingBox();
        provincePoint={x:b.x+point.x,y:b.y+point.y};
        await page.mouse.move(provincePoint.x,provincePoint.y);
      }
      if (n===Math.round(47.6*fps)) {
        await page.mouse.click(provincePoint.x,provincePoint.y);
        await expect(app.getByRole('heading',{name:'湖南省',exact:true})).toBeVisible();
        await app.locator('.observation-scroll').evaluate(e=>{e.scrollTop=0;});
        await page.waitForTimeout(300);
        detailsBox=await app.locator('.day-details').boundingBox();
      }
      if (n===54*fps) {
        await app.locator('.atlas-app').evaluate(e=>{const s=e.__vueParentComponent.setupState;s.select('');s.setDate(0,'2026-10-03');s.seekMinute(1080);});
        await settle();
      }
      if (scene===2) {
        // The application computes every shown solar vector; the edit compresses the day into ten seconds.
        await setMinute(Math.round(270+870*Math.min(local/9.6,1)));
      }
      let pointer=null, ring=false;
      if (scene===3) {
        const progress=Math.min(Math.max((local-.65)/4.2,0),1);
        const minute=Math.round(1020-600*progress);
        const x=sliderBox.x+9+(sliderBox.width-18)*minute/1440;
        const y=sliderBox.y+sliderBox.height/2;
        if (n===21*fps) { await page.mouse.move(x,y); await page.mouse.down(); }
        await page.mouse.move(x,y);
        if (local<5) { pointer={x,y}; ring=local<1.15; }
        if (n===26*fps) await page.mouse.up();
      }
      if (scene===4) {
        if (local<2.65) { pointer=summerPoint; ring=local>2.3; }
        if (local>=2.5) await setMinute(Math.round(Math.min((local-2.5)*14,63)));
      }
      if (scene===5&&local>=5) await setMinute(Math.round(420+60*Math.min((local-5)/6,1)));
      if (scene===6&&local<1.6) { pointer=provincePoint; ring=local>=.5&&local<1.1; }
      let highlight=null;
      if (scene===6&&detailsBox&&local>1.7) {
        const cells=app.locator(local<4.3?'.event-grid':'.daylight-total');
        const b=await cells.boundingBox();
        highlight={x:b.x-5,y:b.y-5,width:b.width+10,height:b.height+10};
      }
      const caption=captions.find(([a,b])=>t>=a&&t<b)?.[2]??'';
      await page.evaluate(({t,scene,local,title,caption,pointer,ring,highlight})=>{
        document.querySelector('#title').textContent=title;
        document.querySelector('#title').style.opacity=scene===1?String(Math.min(local/.6,1)):'1';
        document.querySelector('#caption').textContent=caption;
        document.querySelector('#badge').style.display=scene===2||(scene===4&&local>2.5)||(scene===5&&local>=5)?'block':'none';
        for(const id of ['summer','winter'])document.querySelector('#'+id).style.display=scene===5?'block':'none';
        const p=document.querySelector('#pointer');p.style.display=pointer?'block':'none';if(pointer){p.style.left=pointer.x+'px';p.style.top=pointer.y+'px';}
        const r=document.querySelector('#ring');r.style.display=ring?'block':'none';if(pointer){r.style.left=pointer.x+'px';r.style.top=pointer.y+'px';}
        const h=document.querySelector('#highlight');h.style.display=highlight?'block':'none';if(highlight){h.style.left=highlight.x+'px';h.style.top=highlight.y+'px';h.style.width=highlight.width+'px';h.style.height=highlight.height+'px';}
        document.querySelector('#end').style.opacity=scene===7?String(Math.min(local/.8,1)):0;
        document.querySelector('#progress').style.width=t/60*100+'%';
        const opacity=t<.4?.35+.65*t/.4:t>59.4?1-.65*(t-59.4)/.6:1;
        document.body.style.opacity=opacity;
      },{t,scene,local,title:plan.scenes[scene].title,caption,pointer,ring,highlight});
      await page.screenshot({path:join(frames,`${String(n).padStart(5,'0')}.jpg`),type:'jpeg',quality:94});
      if (n%fps===0) console.log(`已录制 ${Math.floor(t)+1}/60 秒`);
      if ([3,8,16,24,32,38,51,57].includes(t)) {
        await page.screenshot({path:join(output,`scene-${scene+1}.png`)});
        const metrics=await app.evaluate(()=>({
          dates:[...document.querySelectorAll('.map-day')].map(e=>e.textContent.trim()),
          clock:document.querySelector('[data-testid=clock]').textContent,
          maps:[...document.querySelectorAll('.map-pane')].map(e=>({names:e.__vueParentComponent.exposed.getProvinceLabels().length,inset:e.__vueParentComponent.exposed.getInsetLabels()})),
          overflow:document.documentElement.scrollWidth>innerWidth,
          errors:document.querySelectorAll('.map-error,.panel-error').length,
          details:document.querySelector('.region-details')?.textContent??null
        }));
        if(metrics.overflow||metrics.errors||metrics.maps.some(m=>m.names!==34||m.inset.length<6))throw new Error(`画面检查失败：${JSON.stringify(metrics)}`);
        checks.push({scene:scene+1,time:t,...metrics});
        writeFileSync(join(output,'capture-check.json'),JSON.stringify({createdAt:new Date().toISOString(),checks,errors},null,2));
      }
      if (n===38*fps) {
        // Separate full-resolution social cover; no changes to the application's UI.
        await page.evaluate(()=>{document.querySelector('#title').textContent='中国昼夜地图 · 夏至与冬至';const c=document.querySelector('#caption');c.textContent='同一时刻，不同昼夜';c.classList.add('cover-title');});
        await page.screenshot({path:join(output,'宣传封面.png')});
        await page.evaluate(()=>document.querySelector('#caption').classList.remove('cover-title'));
      }
    }
    if(errors.length)throw new Error(errors.join('\n'));
    writeFileSync(join(output,'capture-check.json'),JSON.stringify({createdAt:new Date().toISOString(),checks,errors},null,2));
  } finally { await browser.close(); }
}

console.log('正在合成1080p视频与混音');
const args=['-y','-hide_banner','-loglevel','warning','-framerate',String(fps),'-i',join(frames,'%05d.jpg'),'-i',resolve('src/mp3/钢琴曲.mp3')];
for(const voice of voices)args.push('-i',voice.path);
const filters=voices.map((voice,i)=>`[${i+2}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.15,afade=t=in:d=0.03,afade=t=out:st=${Math.max(0,voice.duration-.1).toFixed(3)}:d=0.1,adelay=${Math.round(voice.start*1000)}:all=1[v${i}]`);
filters.push(`${voices.map((_,i)=>`[v${i}]`).join('')}amix=inputs=8:normalize=0,apad,atrim=duration=60,asplit=2[voice][duck]`);
filters.push('[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=60,asetpts=PTS-STARTPTS,volume=0.23,afade=t=in:d=1.8,afade=t=out:st=57:d=3[music]');
filters.push('[music][duck]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=420[bed]');
filters.push('[voice][bed]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9[a]');
args.push('-filter_complex',filters.join(';'),'-map','0:v','-map','[a]','-vf','scale=out_color_matrix=bt709:out_range=tv','-t','60','-r','30','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',join(output,'中国昼夜地图-宣传片.mp4'));
run('ffmpeg',args);
const metadata=probe(join(output,'中国昼夜地图-宣传片.mp4'));
writeFileSync(join(output,'video-check.json'),JSON.stringify({createdAt:new Date().toISOString(),width:plan.width,height:plan.height,duration:plan.duration,voices,metadata},null,2));
console.log('成片完成',join(output,'中国昼夜地图-宣传片.mp4'));
