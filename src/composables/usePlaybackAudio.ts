import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

export function usePlaybackAudio(audio: Readonly<Ref<HTMLAudioElement | undefined>>, playing: Readonly<Ref<boolean>>, elapsedSeconds: Readonly<Ref<number>>, musicEnabled: Readonly<Ref<boolean>>) {
  const error = ref('');
  let request = 0, disposed = false;
  const active = () => playing.value && musicEnabled.value;

  function pause() { ++request; audio.value?.pause(); }
  function sync() {
    const element = audio.value;
    if (disposed || !element || !element.readyState || !Number.isFinite(element.duration) || element.duration <= 0) return;
    const target = Math.max(0, elapsedSeconds.value) % element.duration;
    try { if (Math.abs(element.currentTime - target) > 0.02) element.currentTime = target; }
    catch { /* Retry with the latest timeline position when metadata/playback becomes ready. */ }
  }
  function failed(element: HTMLAudioElement, cause?: unknown) {
    element.pause();
    error.value = cause instanceof DOMException && cause.name === 'NotAllowedError'
      ? '音乐未能自动播放，可点击“重试音乐”。'
      : '音乐加载或播放失败，可点击“重试音乐”。';
  }
  function mediaError() {
    if (disposed || !active() || !audio.value) return;
    ++request; failed(audio.value);
  }
  function play() {
    const element = audio.value;
    if (disposed || !active() || !element) return;
    const attempt = ++request;
    try {
      if (element.error) element.load();
      sync();
      // Keep this call synchronous so a manual play/retry retains the user gesture.
      void element.play().then(() => {
        if (disposed || !active() || element !== audio.value) { element.pause(); return; }
        if (attempt === request) { sync(); error.value = ''; }
      }).catch(cause => {
        if (!disposed && active() && element === audio.value && attempt === request) failed(element, cause);
      });
    } catch (cause) {
      if (attempt === request) failed(element, cause);
    }
  }
  function removeListeners(element?: HTMLAudioElement) {
    element?.removeEventListener('error', mediaError);
    element?.removeEventListener('loadedmetadata', sync);
  }
  watch(audio, (element, previous) => {
    removeListeners(previous);
    element?.addEventListener('error', mediaError);
    element?.addEventListener('loadedmetadata', sync);
    sync();
  }, { flush: 'sync', immediate: true });
  // Seek only while paused or starting/loading; native playback runs freely between frames.
  watch(elapsedSeconds, () => { if (!playing.value) sync(); }, { flush: 'sync' });
  watch([playing, musicEnabled], ([value, enabled]) => {
    if (value && enabled) play();
    else { pause(); sync(); if (!enabled) error.value = ''; }
  }, { flush: 'sync' });
  onBeforeUnmount(() => {
    disposed = true; pause(); removeListeners(audio.value);
    audio.value?.removeAttribute('src'); audio.value?.load();
  });
  return { error, retry: play };
}
