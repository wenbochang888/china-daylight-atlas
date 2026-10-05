import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  native: true,
  get: vi.fn(), set: vi.fn(), addListener: vi.fn(), getState: vi.fn(), remove: vi.fn(),
  setStyle: vi.fn(), hide: vi.fn(), show: vi.fn(), open: vi.fn(), browserListener: vi.fn(), browserRemove: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native, getPlatform: () => mocks.native ? 'ios' : 'web' } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: mocks.get, set: mocks.set } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.addListener, getState: mocks.getState } }));
vi.mock('@capacitor/status-bar', () => ({ StatusBar: { setStyle: mocks.setStyle, hide: mocks.hide, show: mocks.show }, Style: { Dark: 'DARK', Light: 'LIGHT' }, Animation: { None: 'NONE' } }));
vi.mock('@capacitor/browser', () => ({ Browser: { open: mocks.open, addListener: mocks.browserListener } }));
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(() => {
  vi.resetModules();vi.resetAllMocks();mocks.native = true;
  vi.stubGlobal('document', { documentElement: { dataset: {} } });
  mocks.get.mockResolvedValue({ value: null });mocks.set.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);mocks.getState.mockResolvedValue({ isActive: true });
  mocks.addListener.mockResolvedValue({ remove: mocks.remove });
  mocks.setStyle.mockResolvedValue(undefined);mocks.hide.mockResolvedValue(undefined);mocks.show.mockResolvedValue(undefined);
  mocks.browserRemove.mockResolvedValue(undefined);mocks.browserListener.mockResolvedValue({ remove: mocks.browserRemove });
});
afterEach(() => vi.unstubAllGlobals());
describe('iOS 平台边界', () => {
  it('挂载前读取偏好；读取失败采用默认值，写入按顺序完成', async () => {
    const runtime = await import('../../src/platform/runtime');
    mocks.get.mockImplementation(async ({ key }) => { if (key === runtime.preferenceKeys.theme) return { value: 'dark' };throw new Error('unavailable'); });
    await runtime.initializePlatform();
    expect(runtime.readPreference(runtime.preferenceKeys.theme)).toBe('dark');
    expect(runtime.readPreference(runtime.preferenceKeys.music)).toBeNull();
    let complete!: () => void;
    mocks.set.mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; }));
    runtime.writePreference(runtime.preferenceKeys.theme, 'light');
    runtime.writePreference(runtime.preferenceKeys.theme, 'dark');
    expect(runtime.readPreference(runtime.preferenceKeys.theme)).toBe('dark');
    await vi.waitFor(() => expect(mocks.set).toHaveBeenCalledTimes(1));
    complete();await vi.waitFor(() => expect(mocks.set.mock.calls.map(call => call[0].value)).toEqual(['light', 'dark']));
  });
  it('迟到的初始状态不能覆盖失活事件；卸载后的事件不再生效', async () => {
    let initial!: (value: { isActive: boolean }) => void;
    mocks.getState.mockImplementation(() => new Promise(resolve => { initial = resolve; }));
    const runtime = await import('../../src/platform/runtime'), callback = vi.fn();
    const dispose = runtime.listenAppActivity(callback);await vi.waitFor(() => expect(mocks.getState).toHaveBeenCalledTimes(1));
    const event = mocks.addListener.mock.calls[0][1];event({ isActive: false });
    initial({ isActive: true });await settle();
    expect(callback.mock.calls).toEqual([[false]]);
    dispose();event({ isActive: true });expect(callback).toHaveBeenCalledTimes(1);expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
  it('注册监听尚未完成时卸载，迟到的 handle 仍会释放', async () => {
    let registered!: (value: { remove: typeof mocks.remove }) => void;
    mocks.addListener.mockImplementation(() => new Promise(resolve => { registered = resolve; }));
    const runtime = await import('../../src/platform/runtime'), callback = vi.fn();
    const dispose = runtime.listenAppActivity(callback);await vi.waitFor(() => expect(mocks.addListener).toHaveBeenCalledTimes(1));dispose();
    registered({ remove: mocks.remove });await settle();
    expect(mocks.remove).toHaveBeenCalledTimes(1);expect(mocks.getState).not.toHaveBeenCalled();expect(callback).not.toHaveBeenCalled();
  });
  it('状态栏以最后一次请求为准，外链使用原生浏览器', async () => {
    const runtime = await import('../../src/platform/runtime');
    runtime.setSystemAppearance(true, true);runtime.setSystemAppearance(false, false);await vi.waitFor(() => expect(mocks.show).toHaveBeenCalledTimes(1));
    expect(mocks.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });expect(mocks.hide).not.toHaveBeenCalled();expect(mocks.show).toHaveBeenCalledTimes(1);
    await runtime.openExternalUrl('https://github.com/wenbochang888/china-daylight-atlas');expect(mocks.open).toHaveBeenCalledTimes(1);
    runtime.setSystemAppearance(true, false);await vi.waitFor(() => expect(mocks.setStyle).toHaveBeenLastCalledWith({ style: 'DARK' }));
    mocks.setStyle.mockClear();mocks.browserListener.mock.calls[0][1]();
    await vi.waitFor(() => expect(mocks.setStyle).toHaveBeenLastCalledWith({ style: 'DARK' }));expect(mocks.browserRemove).toHaveBeenCalledTimes(1);
  });
  it('网页继续使用 localStorage，失败不抛错且不调用原生插件', async () => {
    mocks.native = false;const getItem = vi.fn().mockReturnValue('dark'), setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem });
    const runtime = await import('../../src/platform/runtime');await runtime.initializePlatform();
    expect(runtime.readPreference('theme')).toBe('dark');runtime.writePreference('theme', 'light');expect(setItem).toHaveBeenCalledWith('theme', 'light');
    getItem.mockImplementation(() => { throw new Error('blocked'); });setItem.mockImplementation(() => { throw new Error('blocked'); });
    expect(runtime.readPreference('theme')).toBeNull();expect(() => runtime.writePreference('theme', 'dark')).not.toThrow();
    runtime.listenAppActivity(vi.fn())();runtime.setSystemAppearance(true, true);await runtime.openExternalUrl('https://github.com');
    expect(mocks.get).not.toHaveBeenCalled();expect(mocks.addListener).not.toHaveBeenCalled();expect(mocks.open).not.toHaveBeenCalled();
  });
});
