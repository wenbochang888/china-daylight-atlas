import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { nativeIos } from '../platform/runtime';

// Keep the same map subtree mounted in native fullscreen and its viewport fallback.
export function useMapFullscreen(target: Ref<HTMLElement | undefined>) {
  const mode = ref<'none' | 'native' | 'viewport'>('none'), pending = ref(false);
  const active = computed(() => mode.value !== 'none');
  let generation = 0, disposed = false;
  let trigger: HTMLElement | null = null;
  let saved: { x: number; y: number; scrollTop: number; overflow: string; position: string; top: string; width: string } | undefined;
  function restore() {
    mode.value = 'none'; ++generation;
    const previous = saved; saved = undefined;
    if (previous) {
      Object.assign(document.body.style, { overflow: previous.overflow, position: previous.position, top: previous.top, width: previous.width });
      void nextTick(() => {
        if (active.value || disposed) return;
        window.scrollTo(previous.x, previous.y);
        if (target.value) target.value.scrollTop = previous.scrollTop;
        const opener = trigger?.isConnected ? trigger : target.value?.querySelector<HTMLButtonElement>('[aria-label="全屏查看地图"]');
        opener?.focus({ preventScroll: true });
      });
    }
  }
  function exitNative() {
    if (document.fullscreenElement === target.value) void document.exitFullscreen().catch(() => {
      // If the browser refuses to exit, keep the exit control and layout usable.
      if (!disposed && document.fullscreenElement === target.value) mode.value = 'native';
    });
  }
  function exit() {
    if (document.fullscreenElement === target.value) {
      ++generation; exitNative();
    } else restore();
  }
  function enter(event: Event) {
    const element = target.value;
    if (!element || active.value || pending.value || disposed) return;
    trigger = event.currentTarget as HTMLElement;
    const style = document.body.style;
    saved = { x: window.scrollX, y: window.scrollY, scrollTop: element.scrollTop, overflow: style.overflow, position: style.position, top: style.top, width: style.width };
    Object.assign(style, { overflow: 'hidden', position: 'fixed', top: `${-saved.y}px`, width: '100%' });
    element.scrollTop = 0;
    mode.value = 'viewport';
    const attempt = ++generation;
    void nextTick(() => { if (active.value) element.querySelector<HTMLButtonElement>('[aria-label="退出全屏"]')?.focus(); });
    if (nativeIos || !element.requestFullscreen || document.fullscreenEnabled === false) return;
    pending.value = true;
    try {
      // Invoke before yielding so the browser receives the original user gesture.
      void element.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        if (disposed || attempt !== generation || !active.value) { exitNative(); return; }
        if (document.fullscreenElement === element) mode.value = 'native';
      }).catch(() => {
        if (!disposed && attempt === generation && active.value) mode.value = 'viewport';
      }).finally(() => { pending.value = false; });
    } catch { pending.value = false; }
  }
  function fullscreenChange() {
    if (document.fullscreenElement === target.value) {
      if (!active.value || disposed) exitNative();
      else mode.value = 'native';
    } else if (mode.value === 'native') restore();
  }
  function keyboard(event: KeyboardEvent) {
    if (!active.value) return;
    if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
    if (event.key !== 'Tab') return;
    const buttons = [...target.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []].filter(button => button.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement as HTMLButtonElement))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement as HTMLButtonElement))) {
      event.preventDefault(); first.focus();
    }
  }
  onMounted(() => {
    document.addEventListener('fullscreenchange', fullscreenChange);
    document.addEventListener('keydown', keyboard);
  });
  onBeforeUnmount(() => {
    exitNative(); restore(); disposed = true;
    document.removeEventListener('fullscreenchange', fullscreenChange);
    document.removeEventListener('keydown', keyboard);
  });
  return { mode, active, pending, enter, exit };
}
