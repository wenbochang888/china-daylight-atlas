import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { advancePlayback } from '../domain/national-playback';
import type { PlaybackMultiplier, PlaybackSegment } from '../domain/types';

export function usePlayback(minute: Ref<number>, segments: Readonly<Ref<PlaybackSegment[]>>, multiplier: Readonly<Ref<PlaybackMultiplier>>) {
  const playing = ref(false);
  let frame = 0, previous: number | null = null;
  function pause() { playing.value = false; cancelAnimationFrame(frame); previous = null; }
  function advance(now: number, factor = multiplier.value) {
    const result = advancePlayback(minute.value, previous !== null ? Math.max(0,now - previous) / 1000 : 0, segments.value, factor);
    previous = now; minute.value = result.minute;
    if (result.stopped) pause();
  }
  function tick(now: number) {
    if (!playing.value) return;
    advance(now);
    if (playing.value) frame = requestAnimationFrame(tick);
  }
  // Settle time under the old rate before applying a new browsing multiplier.
  watch(multiplier, (_value, old) => { if (playing.value) advance(performance.now(), old); }, { flush: 'sync' });
  function start() {
    if (playing.value || !segments.value.length || document.hidden) return;
    if (minute.value >= 1440) minute.value = 0;
    playing.value = true; previous = performance.now(); frame = requestAnimationFrame(tick);
  }
  function toggle() { if (playing.value) pause(); else start(); }
  function visibility() { if (document.hidden) pause(); }
  document.addEventListener('visibilitychange', visibility);
  onBeforeUnmount(() => { pause(); document.removeEventListener('visibilitychange', visibility); });
  return { playing, pause, start, toggle };
}
