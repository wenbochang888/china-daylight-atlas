import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRenderer, ref, shallowRef, type App } from 'vue';
import { usePlaybackAudio } from '../../src/composables/usePlaybackAudio';
import { usePlayback } from '../../src/composables/usePlayback';

const renderer = createRenderer<object,object>({
  patchProp(){}, insert(){}, remove(){}, createElement:()=>({}), createText:()=>({}), createComment:()=>({}),
  setText(){}, setElementText(){}, parentNode:()=>null, nextSibling:()=>null,
});
class Media extends EventTarget {
  currentTime = 0;
  readyState = 1;
  duration = 265;
  paused = true;
  error: { code: number } | null = null;
  play = vi.fn((): Promise<void> => { this.paused = false; return Promise.resolve(); });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn(() => { this.error = null; this.currentTime = 0; });
  removeAttribute = vi.fn();
}
let app: App | undefined;
afterEach(() => { app?.unmount(); app=undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
function deferred() {
  let resolve!: () => void, reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes,no) => { resolve=yes; reject=no; });
  return { promise, resolve, reject };
}
function setup(withPlayback = false) {
  const media = new Media(), audio = shallowRef<HTMLAudioElement | undefined>(media as unknown as HTMLAudioElement);
  const playing = ref(false), minute = ref(0), elapsed = ref(0);
  const doc = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  let controls!: ReturnType<typeof usePlaybackAudio>, playback: ReturnType<typeof usePlayback> | undefined;
  app=renderer.createApp({setup(){
    if (withPlayback) playback=usePlayback(minute,ref([{startMinute:0,endMinute:1440,speed:90 as const}]),ref(1 as const));
    controls=usePlaybackAudio(audio,playback?.playing ?? playing,elapsed); return()=>null;
  }}); app.mount({});
  return { media, audio, elapsed, playing: playback?.playing ?? playing, controls, playback, doc };
}

describe('共享播放音频', () => {
  it('初始静音，开始同步调用播放；暂停保留进度，续播不归零', async () => {
    const p=setup(); expect(p.media.play).not.toHaveBeenCalled();
    p.playing.value=true; expect(p.media.play).toHaveBeenCalledTimes(1); await settle();
    p.media.currentTime=42; p.elapsed.value=42; p.playing.value=false;
    expect(p.media.paused).toBe(true); expect(p.media.currentTime).toBe(42);
    p.playing.value=true; await settle(); expect(p.media.currentTime).toBe(42); expect(p.media.paused).toBe(false);
  });
  it('拖动立即跳到目标音乐位置，元数据暂不可用时加载后应用最新位置', () => {
    const p=setup(); p.media.currentTime=1; p.elapsed.value=10.707933213975695;
    expect(p.media.currentTime).toBeCloseTo(10.707933213975695,10); expect(p.media.play).not.toHaveBeenCalled();
    let time=42, ready=false;
    Object.defineProperty(p.media,'currentTime',{get:()=>time,set:(value:number)=>{if(!ready)throw new Error('metadata');time=value;}});
    p.elapsed.value=20; expect(time).toBe(42); p.elapsed.value=30;
    ready=true; p.media.dispatchEvent(new Event('loadedmetadata')); expect(time).toBe(30);
  });
  it('累计耗时超过曲长时取余，拖回零点或整首边界时归零', () => {
    const p=setup(); p.elapsed.value=280; expect(p.media.currentTime).toBe(15);
    p.elapsed.value=530; expect(p.media.currentTime).toBe(0);
    p.elapsed.value=12; p.elapsed.value=0; expect(p.media.currentTime).toBe(0);
  });
  it('播放帧不反复seek，暂停与续播对齐当前地图对应进度', async () => {
    const p=setup(); let position=0;
    const seek=vi.fn((value:number)=>{position=value;});
    Object.defineProperty(p.media,'currentTime',{get:()=>position,set:seek});
    p.playing.value=true; await settle();
    for(let second=1;second<=10;second++)p.elapsed.value=second;
    expect(seek).not.toHaveBeenCalled(); p.playing.value=false; expect(position).toBe(10);
    p.media.currentTime=1; p.playing.value=true; await settle(); expect(position).toBe(10);
  });
  it('首次加载和迟到的启动成功按最新地图时刻定位，不从旧位置开始', async () => {
    const p=setup(), pending=deferred(); p.media.duration=NaN; p.media.readyState=0;
    p.elapsed.value=10; expect(p.media.currentTime).toBe(0); p.media.play.mockReturnValueOnce(pending.promise);
    p.playing.value=true; p.elapsed.value=20;
    p.media.readyState=1; p.media.duration=265; p.media.dispatchEvent(new Event('loadedmetadata')); expect(p.media.currentTime).toBe(20);
    p.elapsed.value=30; pending.resolve(); await settle(); expect(p.media.currentTime).toBe(30);
  });
  it('播放被拦截时保留地图播放状态，重试成功才清除错误', async () => {
    const p=setup(); p.media.play.mockRejectedValueOnce(new DOMException('blocked','NotAllowedError'));
    p.playing.value=true; await settle(); expect(p.playing.value).toBe(true); expect(p.controls.error.value).toContain('音乐');
    p.controls.retry(); await settle(); expect(p.controls.error.value).toBe(''); expect(p.media.paused).toBe(false);
  });
  it('媒体加载错误暂停声音但不暂停地图，重试重新加载失败资源', async () => {
    const p=setup(); p.playing.value=true; await settle();
    p.media.error={code:2}; p.media.dispatchEvent(new Event('error'));
    expect(p.playing.value).toBe(true); expect(p.media.paused).toBe(true); expect(p.controls.error.value).toContain('加载');
    p.elapsed.value=43; p.controls.retry(); expect(p.media.load).toHaveBeenCalledTimes(1);
    await settle(); expect(p.controls.error.value).toBe(''); expect(p.media.currentTime).toBe(43);
  });
  it('同步播放异常也被捕获，暂停时重试不会播放', () => {
    const p=setup(); p.media.play.mockImplementationOnce(()=>{throw new Error('media');});
    expect(()=>{p.playing.value=true;}).not.toThrow(); expect(p.controls.error.value).not.toBe('');
    p.playing.value=false; p.controls.retry(); expect(p.media.play).toHaveBeenCalledTimes(1);
  });
  it('暂停后迟到的播放成功不会恢复声音，迟到的拒绝不会显示错误', async () => {
    const p=setup(), first=deferred(), second=deferred();
    p.media.play.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    p.playing.value=true; p.playing.value=false; p.media.paused=false; first.resolve(); await settle();
    expect(p.media.paused).toBe(true);
    p.playing.value=true; p.playing.value=false; second.reject(new Error('late')); await settle(); expect(p.controls.error.value).toBe('');
  });
  it('旧请求成功不暂停新播放，旧请求拒绝不覆盖新错误', async () => {
    const p=setup(), old=deferred(); p.media.play.mockReturnValueOnce(old.promise);
    p.playing.value=true; p.playing.value=false; p.playing.value=true; await settle();
    const pauses=p.media.pause.mock.calls.length; old.resolve(); await settle();
    expect(p.media.pause).toHaveBeenCalledTimes(pauses); expect(p.media.paused).toBe(false);
    const older=deferred(); p.playing.value=false; p.media.play.mockReturnValueOnce(older.promise); p.playing.value=true;
    p.playing.value=false; p.media.play.mockRejectedValueOnce(new DOMException('blocked','NotAllowedError')); p.playing.value=true;
    await settle(); const message=p.controls.error.value; older.reject(new Error('late')); await settle(); expect(p.controls.error.value).toBe(message);
  });
  it('媒体错误使尚未完成的播放请求失效，不被迟到的成功清除', async () => {
    const p=setup(), pending=deferred(); p.media.play.mockReturnValueOnce(pending.promise);
    p.playing.value=true; p.media.error={code:2}; p.media.dispatchEvent(new Event('error'));
    const message=p.controls.error.value; pending.resolve(); await settle(); expect(p.controls.error.value).toBe(message);
  });
  it('跟随现有后台暂停，回来不自动恢复，音乐进度保留', async () => {
    const p=setup(true); p.playback!.start(); await settle(); p.media.currentTime=42; p.elapsed.value=42;
    p.doc.hidden=true; p.doc.dispatchEvent(new Event('visibilitychange')); expect(p.media.paused).toBe(true);
    p.doc.hidden=false; p.doc.dispatchEvent(new Event('visibilitychange'));
    expect(p.playing.value).toBe(false); expect(p.media.currentTime).toBe(42);
  });
  it('卸载停止声音、移除监听和资源，迟到的请求不写错误状态', async () => {
    const p=setup(), pending=deferred(), remove=vi.spyOn(p.media,'removeEventListener');
    p.media.play.mockReturnValueOnce(pending.promise); p.playing.value=true; app!.unmount(); app=undefined;
    expect(p.media.paused).toBe(true); expect(remove).toHaveBeenCalledWith('error',expect.any(Function));
    expect(remove).toHaveBeenCalledWith('loadedmetadata',expect.any(Function)); expect(p.media.removeAttribute).toHaveBeenCalledWith('src'); expect(p.media.load).toHaveBeenCalled();
    pending.reject(new Error('late')); await settle(); expect(p.controls.error.value).toBe('');
  });
});
