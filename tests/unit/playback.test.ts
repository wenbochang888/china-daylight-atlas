import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRenderer, ref, type App } from 'vue';
import { usePlayback } from '../../src/composables/usePlayback';
import { advancePlayback, combinePlaybackSegments, playbackElapsedSeconds } from '../../src/domain/national-playback';
import type { PlaybackMultiplier, PlaybackSegment } from '../../src/domain/types';

const renderer = createRenderer<object,object>({
  patchProp(){}, insert(){}, remove(){}, createElement:()=>({}), createText:()=>({}), createComment:()=>({}),
  setText(){}, setElementText(){}, parentNode:()=>null, nextSibling:()=>null,
});
let app: App | undefined;
afterEach(()=>{app?.unmount();app=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
function playback() {
  let now=0,id=0;const frames=new Map<number,FrameRequestCallback>();
  const doc=Object.assign(new EventTarget(),{hidden:false});
  vi.stubGlobal('document',doc);
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++id,callback);return id;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
  vi.spyOn(performance,'now').mockImplementation(()=>now);
  const minute=ref(0), multiplier=ref<PlaybackMultiplier>(1), active=ref(true);
  const segments=ref<PlaybackSegment[]>([{startMinute:0,endMinute:300,speed:90},{startMinute:300,endMinute:600,speed:8},{startMinute:600,endMinute:1440,speed:90}]);
  let controls!:ReturnType<typeof usePlayback>;
  app=renderer.createApp({setup(){controls=usePlayback(minute,segments,multiplier,active);return()=>null;}});app.mount({});
  const time=(value:number)=>{now=value;};
  const frame=(value:number)=>{time(value);const entry=frames.entries().next().value!;frames.delete(entry[0]);entry[1](now);};
  return {minute,multiplier,active,controls,frames,doc,time,frame};
}
describe('播放生命周期与倍率',()=>{
  it('原生失活同步暂停，拒绝后台播放，回来不自动恢复',()=>{
    const p=playback();p.controls.start();p.frame(1000);p.active.value=false;
    expect(p.controls.playing.value).toBe(false);expect(p.frames.size).toBe(0);
    p.controls.start();expect(p.frames.size).toBe(0);
    p.active.value=true;expect(p.controls.playing.value).toBe(false);
    p.time(9000);p.controls.start();p.frame(10000);expect(p.minute.value).toBe(180);
  });
  it('时刻转换为从零点实际播放耗时，跨速度段并包含24:00',()=>{
    const segments:PlaybackSegment[]=[{startMinute:0,endMinute:300,speed:90},{startMinute:300,endMinute:600,speed:8},{startMinute:600,endMinute:1440,speed:90}];
    expect(playbackElapsedSeconds(0,segments)).toBe(0);
    expect(playbackElapsedSeconds(300,segments)).toBeCloseTo(300/90,10);
    expect(playbackElapsedSeconds(360,segments)).toBeCloseTo(300/90+60/8,10);
    expect(playbackElapsedSeconds(1440,segments)).toBeCloseTo(300/90+300/8+840/90,10);
    expect(playbackElapsedSeconds(-10,segments)).toBe(0);
    expect(playbackElapsedSeconds(1500,segments)).toBe(playbackElapsedSeconds(1440,segments));
    expect(playbackElapsedSeconds(360,[])).toBe(0);
    for(const factor of [1,0.5] as const) for(const minute of [0,150,300,360,600,1000,1440])
      expect(advancePlayback(0,playbackElapsedSeconds(minute,segments,factor),segments,factor).minute).toBeCloseTo(minute,8);
  });
  it('双日按合并后的慢速阶段累计音乐耗时',()=>{
    const combined=combinePlaybackSegments([
      [{startMinute:0,endMinute:1440,speed:90}],
      [{startMinute:0,endMinute:300,speed:90},{startMinute:300,endMinute:600,speed:8},{startMinute:600,endMinute:1440,speed:90}],
    ]);
    expect(playbackElapsedSeconds(360,combined)).toBeCloseTo(300/90+60/8,10);
  });
  it('倍率切换先结算旧速度，维持单一循环与连续时刻',()=>{
    const p=playback();p.controls.start();p.controls.start();expect(p.frames.size).toBe(1);
    p.frame(1000);expect(p.minute.value).toBe(90);
    p.time(1500);p.multiplier.value=0.5;expect(p.minute.value).toBe(135);expect(p.controls.playing.value).toBe(true);
    p.frame(2500);expect(p.minute.value).toBe(180);expect(p.frames.size).toBe(1);
    p.time(3000);p.multiplier.value=1;expect(p.minute.value).toBe(202.5);
    p.frame(3500);expect(p.minute.value).toBe(247.5);
  });
  it('暂停、手动换时刻及恢复不会补算暂停耗时，日终停止再播归零',()=>{
    const p=playback();p.controls.start();p.frame(1000);p.controls.pause();expect(p.frames.size).toBe(0);
    p.minute.value=400;p.time(10000);p.controls.start();p.frame(11000);expect(p.minute.value).toBe(408);
    p.controls.pause();p.minute.value=1430;p.controls.start();p.frame(12000);
    expect(p.minute.value).toBe(1440);expect(p.controls.playing.value).toBe(false);expect(p.frames.size).toBe(0);
    p.controls.start();expect(p.minute.value).toBe(0);
  });
  it('后台暂停，回来不自动播放，卸载清理帧与监听',()=>{
    const p=playback();const remove=vi.spyOn(p.doc,'removeEventListener');p.controls.start();
    p.doc.hidden=true;p.doc.dispatchEvent(new Event('visibilitychange'));expect(p.controls.playing.value).toBe(false);
    p.controls.start();expect(p.frames.size).toBe(0);
    p.doc.hidden=false;p.doc.dispatchEvent(new Event('visibilitychange'));expect(p.controls.playing.value).toBe(false);
    p.controls.start();app!.unmount();app=undefined;expect(p.frames.size).toBe(0);expect(remove).toHaveBeenCalledWith('visibilitychange',expect.any(Function));
  });
});
