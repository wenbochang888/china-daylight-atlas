<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import MapPane from './components/MapPane.vue';
import RegionDetails from './components/RegionDetails.vue';
import SolarTermPanel from './components/SolarTermPanel.vue';
import MapClock from './components/MapClock.vue';
import TimeScrubber from './components/TimeScrubber.vue';
import UiIcon from './components/UiIcon.vue';
import HeaderActions from './components/HeaderActions.vue';
import AboutDialog from './components/AboutDialog.vue';
import TimeSettingDialog from './components/TimeSettingDialog.vue';
import ShareSceneDialog from './components/ShareSceneDialog.vue';
import { listenAppActivity, nativeIos, preferenceKeys, readPreference, setSystemAppearance, writePreference } from './platform/runtime';
import { beijingDate, beijingMinute, clampDate, clampMinute, dateLimits, formatMinute, previousDate, toInstant } from './domain/beijing-time';
import { solarEvents, solarVector } from './domain/solar';
import { comparisonSummary, morningMinute, parseSharedScene, sharedSceneUrl } from './domain/observation';
import { solarTermForDate, solarTermOptions } from './domain/solar-terms';
import { combinePlaybackSegments, nationalPlaybackSegments, playbackElapsedSeconds, prepareNationalGeometry, type NationalGeometry } from './domain/national-playback';
import { nationalMap } from './data/national-map';
import { usePlayback } from './composables/usePlayback';
import { usePlaybackAudio } from './composables/usePlaybackAudio';
import { useMapFullscreen } from './composables/useMapFullscreen';
import pianoUrl from './mp3/钢琴曲.mp3';
import type { Camera, ExplorePreset, ObservationScene, PlaybackMultiplier, PlaybackSegment, Region, SolarTermOption } from './domain/types';

const now = new Date(), today = ref(beijingDate(now)), limits = ref(dateLimits(now));
const initialShare = nativeIos ? { kind: 'none' as const } : parseSharedScene(window.location.hash, limits.value);
const initialScene = initialShare.kind === 'valid' ? initialShare.scene : undefined;
let initialRegionPending = initialScene?.regionId !== undefined;
const dates = ref<string[]>(initialScene ? [...initialScene.dates] : [today.value]), minute = ref(initialScene?.minute ?? 0);
if (initialShare.kind !== 'none') {
  try { const url = new URL(window.location.href); url.hash = ''; history.replaceState(history.state, '', url); } catch { /* Scene still opens when history is unavailable. */ }
}
const musicPreferenceKey = preferenceKeys.music;
function preferredMusic() { return readPreference(musicPreferenceKey) !== 'false'; }
const musicEnabled = ref(preferredMusic());
function toggleMusic() {
  musicEnabled.value = !musicEnabled.value;
  writePreference(musicPreferenceKey, String(musicEnabled.value));
}
const themePreferenceKey = preferenceKeys.theme;
function preferredDarkMode() { return readPreference(themePreferenceKey) === 'dark'; }
const darkMode = ref(preferredDarkMode());
watch(darkMode, value => {
  document.documentElement.dataset.theme = value ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value ? '#101e27' : '#f4f8fa');
}, { immediate: true });
function toggleTheme() {
  darkMode.value = !darkMode.value;
  writePreference(themePreferenceKey, darkMode.value ? 'dark' : 'light');
}
const termYear = computed(() => Number(today.value.slice(0,4)));
const regions = shallowRef<Region[]>([]), shape = shallowRef<NationalGeometry | null>(null);
const segments = shallowRef<PlaybackSegment[]>([]), terms = shallowRef<SolarTermOption[]>([]);
const dateTerms = shallowRef<Array<string | null>>([]);
const index = computed(() => new Map(regions.value.map(region => [region.id, region])));
const selectedId = ref(initialScene?.regionId ?? ''), selected = computed(() => index.value.get(selectedId.value) ?? null);
const observationDays = computed(() => selected.value ? dates.value.map(date => ({date,events:solarEvents(date,...selected.value!.center)})) : []);
const summary = computed(() => comparisonSummary(observationDays.value));
const camera = ref<Camera | null>(null), target = ref(0);
const compare = computed(() => dates.value.length === 2);
const vectors = computed(() => dates.value.map(date => solarVector(toInstant(date, minute.value))));
const playbackMultiplier = computed<PlaybackMultiplier>(() => 1);
const appActive = ref(true);
const { playing, pause, start, toggle } = usePlayback(minute, segments, playbackMultiplier, appActive);
const playbackAudio = shallowRef<HTMLAudioElement>();
const playbackSeconds = computed(() => playbackElapsedSeconds(minute.value, segments.value, playbackMultiplier.value));
const { error: audioError, retry: retryAudio } = usePlaybackAudio(playbackAudio, playing, playbackSeconds, musicEnabled);
const dataError = ref(''), phaseError = ref(''), termError = ref('');
const notice = ref(initialShare.kind === 'invalid' ? '分享链接无效，已打开默认观测。' : initialShare.kind === 'expired' ? '此分享场景已超出当前观测范围，已打开默认观测。' : '');
const activePreset = ref<ExplorePreset | null>(null), presetBusy = ref(false), presetError = ref(''), presetNotice = ref('');
const sceneChanging = ref(false), mapPanes = ref<InstanceType<typeof MapPane>[]>([]);
let presetRequest = 0, presetTimer: ReturnType<typeof setTimeout> | undefined;
const dataLoading = ref(true), pendingPlay = ref(false);
const mapStates = ref<Array<'loading' | 'ready' | 'error'>>(dates.value.map(() => 'loading'));
const ready = computed(() => appActive.value && !presetBusy.value && !dataLoading.value && !dataError.value && !phaseError.value && !!segments.value.length && dates.value.every((_, i) => mapStates.value[i] === 'ready'));
const detailsOpen = ref(!!initialScene?.regionId);
const mapWorkspace = ref<HTMLElement>(), mapWidth = ref(920);
const { mode: fullscreenMode, active: immersive, pending: fullscreenPending, enter: enterFullscreen, exit: exitFullscreen } = useMapFullscreen(mapWorkspace);
watch([darkMode, immersive], ([dark, fullscreen]) => setSystemAppearance(dark, fullscreen), { immediate: true });
const about = ref<InstanceType<typeof AboutDialog>>();
const timeSetting = ref<InstanceType<typeof TimeSettingDialog>>(), shareDialog = ref<InstanceType<typeof ShareSceneDialog>>();
const mobileMedia = window.matchMedia('(max-width: 600px), (max-height: 600px) and (hover: none) and (pointer: coarse)');
const mobilePresentation = ref(nativeIos || mobileMedia.matches), mobileMapHeight = ref(420);
const mapsReady = computed(() => !dataLoading.value && !dataError.value && dates.value.every((_,i) => mapStates.value[i] === 'ready'));
const timeline = ref<HTMLElement>(), timelineBounds = ref({ left: 0, width: 0 }), timelineHeight = ref(84);
const stackedComparison = computed(() => compare.value && mapWidth.value < 920);
let layoutObserver: ResizeObserver | undefined;
let panelTrigger: HTMLElement | null = null;
let detailsFocusPending = false;
const compact = ref(false), panel = ref<'region' | 'date' | null>(null), dialog = ref<HTMLDialogElement>();
const calendarHost = ref<HTMLDivElement>();

function cancelPlayback() {
  cancelPlaybackPreparation(); pause();
}
function applyScene(scene: ObservationScene, prepared: PlaybackSegment[], labels: Array<string | null>) {
  pendingPlay.value = false; pause();
  mapStates.value = scene.dates.map((_,i) => mapStates.value[i] ?? 'loading');
  dates.value = [...scene.dates]; minute.value = scene.minute; target.value = 0;
  if (scene.regionId !== undefined) selectedId.value = scene.regionId;
  segments.value = prepared; dateTerms.value = labels; phaseError.value = ''; panel.value = null;
}
function selectPreset(preset: ExplorePreset) {
  const alreadyChanging = sceneChanging.value;
  cancelPlayback(); sceneChanging.value = alreadyChanging; presetError.value = ''; presetNotice.value = ''; presetBusy.value = true;
  const attempt = presetRequest, clickedAt = new Date();
  const currentDate = beijingDate(clickedAt), currentLimits = dateLimits(clickedAt);
  // Yield once so the preparation status can paint; commit only a fully prepared scene.
  presetTimer = setTimeout(async () => {
    presetTimer = undefined;
    if (attempt !== presetRequest || !shape.value || !appActive.value) { presetBusy.value = false; return; }
    try {
      let scene: ObservationScene;
      if (preset === 'solstices') {
        const year = currentDate.slice(0,4);
        const options = solarTermOptions({min:`${year}-01-01`,max:`${year}-12-31`});
        const summer = options.find(term => term.name === '夏至')?.date, winter = options.find(term => term.name === '冬至')?.date;
        if (!summer || !winter) throw new Error('missing terms');
        scene = {dates:[summer,winter],minute:420};
      } else {
        const morning = preset === 'morning' ? morningMinute(nationalPlaybackSegments(currentDate,shape.value)) : beijingMinute(clickedAt);
        if (morning === null) throw new Error('missing morning');
        scene = {dates:[currentDate],minute:morning};
      }
      const prepared = combinePlaybackSegments(scene.dates.map(date => nationalPlaybackSegments(date,shape.value!)));
      const labels = scene.dates.map(solarTermForDate);
      if (attempt !== presetRequest) return;
      sceneChanging.value = true;
      await nextTick();
      // Wait for the actual CSS fade, including delayed frames on a busy renderer.
      const fades = mapPanes.value.flatMap(pane => {
        const element = pane.$el as HTMLElement;
        void getComputedStyle(element).opacity;
        return element.getAnimations().map(animation => animation.finished.catch(() => {}));
      });
      await Promise.all(fades);
      if (attempt !== presetRequest) return;
      today.value = currentDate; limits.value = currentLimits;
      applyScene(scene,prepared,labels); activePreset.value = preset;
      await nextTick();
      await Promise.all(mapPanes.value.map(pane => pane.whenPresented()));
      if (attempt !== presetRequest) return;
      presetNotice.value = preset === 'morning' ? `已定位至今天${formatMinute(scene.minute)}，点击播放观察晨光变化。`
        : preset === 'solstices' ? `已定位至${currentDate.slice(0,4)}年夏至与冬至的07:00，点击省份查看差异。`
          : `已定位至${currentDate}北京时间${formatMinute(scene.minute)}，当前保持暂停。`;
    } catch {
      if (attempt !== presetRequest) return;
      presetError.value = preset === 'morning' ? '晨光场景暂时无法准备，请重试。' : '观测场景暂时无法准备，请重试。';
    } finally { if (attempt === presetRequest) { presetBusy.value = false; sceneChanging.value = false; } }
  },0);
}
function openTimeSetting(event: Event) { cancelPlayback(); timeSetting.value?.open(event); }
function seekEvent(i: number, kind: 'sunrise' | 'sunset') {
  const value = observationDays.value[i]?.events[kind];
  if (value === null || value === undefined || !ready.value) return;
  seekMinute(value); panel.value = null;
  notice.value = `已定位至日期${i+1}代表点${kind === 'sunrise' ? '日出' : '日落'}时刻${formatMinute(value)}${compare.value ? '，两张地图同步显示。' : '。'}`;
}
function openShare(event: Event) {
  if (nativeIos || !mapsReady.value) return;
  cancelPlayback();
  const scene: ObservationScene = {dates:compare.value ? [dates.value[0],dates.value[1]] : [dates.value[0]],minute:Math.round(minute.value),regionId:selectedId.value||undefined};
  shareDialog.value?.open(event,{scene,regionName:selected.value?.name ?? '全国观测',summary:summary.value,url:sharedSceneUrl(window.location.href,scene)});
}
function prepareDates() {
  segments.value = []; phaseError.value = '';
  if (!shape.value) return;
  try { segments.value = combinePlaybackSegments(dates.value.map(date => nationalPlaybackSegments(date, shape.value!))); }
  catch { cancelPlayback(); phaseError.value = '全天播放区间计算失败，请重试。'; }
}
function prepareTerms() {
  termError.value = '';
  try {
    terms.value = solarTermOptions({ min: `${termYear.value}-01-01`, max: `${termYear.value}-12-31` });
    dateTerms.value = dates.value.map(solarTermForDate);
  }
  catch { dateTerms.value = []; termError.value = '节气日期计算失败，请重试。'; }
}
watch(() => [...dates.value], prepareTerms);
function setDate(i: number, value: string) {
  cancelPlayback(); activePreset.value = null; const normalized = clampDate(value, limits.value);
  if (value !== normalized) notice.value = '日期已调整到两年观测范围内的有效日期。';
  dates.value[i] = normalized; prepareDates();
}
function toggleCompare() {
  cancelPlayback(); activePreset.value = null;
  if (compare.value) { dates.value = [dates.value[0]]; target.value = 0; mapStates.value = [mapStates.value[0]]; }
  else { dates.value = [dates.value[0], clampDate(previousDate(dates.value[0]), limits.value)]; mapStates.value.push('loading'); }
  prepareDates();
}
function selectTerm(term: SolarTermOption) {
  cancelPlayback(); activePreset.value = null;
  if (!term.date || term.disabled || !shape.value) return;
  dates.value[target.value] = term.date; minute.value = 0; prepareDates();
  if (!phaseError.value) pendingPlay.value = true;
  panel.value = null;
}
function onStatus(i: number, status: 'loading' | 'ready' | 'error') {
  mapStates.value[i] = status;
  if (status === 'error') cancelPlayback();
  else if (status === 'loading') pause();
  scheduleInitialCalculations();
}
function togglePlayback() {
  cancelPlaybackPreparation();
  toggle();
}
function cancelPlaybackPreparation() {
  ++presetRequest; clearTimeout(presetTimer); presetTimer = undefined; presetBusy.value = false; pendingPlay.value = false;
  sceneChanging.value = false;
}
function seekMinute(value: number) { cancelPlayback(); activePreset.value = null; minute.value = clampMinute(Math.round(value)); }
function startScrubbing() { cancelPlayback(); activePreset.value = null; }
watch(playing, value => { if (value) activePreset.value = null; });
watch([ready, pendingPlay], () => {
  if (ready.value && pendingPlay.value) { pendingPlay.value = false; start(); }
}, { flush: 'post' });
function select(id: string) {
  if (id && !index.value.has(id)) return;
  selectedId.value = id; detailsOpen.value = !!id; detailsFocusPending = false;
  if (!id && panel.value === 'region') panel.value = null;
}
function selectFromMap(id: string) {
  select(id);
  if (id && compact.value) {
    panelTrigger = document.querySelector<HTMLButtonElement>('button[aria-label="地区详情"]');
    panel.value = 'region';
  }
}
let initialization = 0, calculationFrame: number | undefined, calculationTimer: ReturnType<typeof setTimeout> | undefined;
function clearInitialCalculations() {
  if (calculationFrame !== undefined) cancelAnimationFrame(calculationFrame);
  clearTimeout(calculationTimer); calculationFrame = undefined; calculationTimer = undefined;
}
function scheduleInitialCalculations() {
  if (shape.value || dataError.value || phaseError.value || dataLoading.value || calculationFrame !== undefined || calculationTimer !== undefined ||
    !dates.value.every((_, i) => mapStates.value[i] === 'ready')) return;
  const attempt = initialization;
  // Give both maps a paint opportunity before scanning national geometry for playback.
  calculationFrame = requestAnimationFrame(() => {
    calculationFrame = undefined;
    calculationTimer = setTimeout(() => {
      calculationTimer = undefined;
      if (attempt !== initialization || !dates.value.every((_, i) => mapStates.value[i] === 'ready')) return;
      try { shape.value = prepareNationalGeometry(nationalMap().provinces); prepareDates(); }
      catch { cancelPlayback(); phaseError.value = '全天播放区间计算失败，请重试。'; }
    }, 0);
  });
}
function initialize() {
  ++initialization; clearInitialCalculations(); shape.value = null; segments.value = []; phaseError.value = '';
  cancelPlayback(); dataError.value = ''; dataLoading.value = true;
  try {
    regions.value = nationalMap().regions;
    if (initialRegionPending) {
      initialRegionPending = false;
      if (!index.value.has(selectedId.value)) {
        selectedId.value = ''; detailsOpen.value = false; notice.value = '地区信息无法识别，已还原日期与时间并保持全国观测。';
      }
    }
  } catch { dataError.value = '内置全国地图准备失败，请刷新页面或重试。'; }
  finally { dataLoading.value = false; }
  scheduleInitialCalculations();
}
function retryCalculations() { cancelPlayback(); prepareTerms(); phaseError.value = ''; if (shape.value) prepareDates(); else scheduleInitialCalculations(); }
function refreshLimits() {
  if (document.hidden) cancelPlayback();
  const current = new Date(), next = dateLimits(current);
  today.value = beijingDate(current);
  if (next.max !== limits.value.max) {
    cancelPlayback(); activePreset.value = null; limits.value = next;
    const normalized = dates.value.map(date => clampDate(date, next));
    dates.value = normalized; prepareTerms(); prepareDates();
    notice.value = `已按北京时间更新观测范围：${next.min} — ${next.max}。`;
  }
}
function setDetailsOpen(value: boolean) {
  detailsFocusPending = true; detailsOpen.value = value;
}
function restoreDetailsFocus(element: Element) {
  if (!detailsFocusPending) return;
  const button = element.matches('button') ? element : element.querySelector('button[aria-label="关闭地区详情"]');
  if (button instanceof HTMLElement) button.focus();
  detailsFocusPending = false;
}
function openPanel(value: 'region' | 'date', event: Event) {
  panelTrigger = event.currentTarget as HTMLElement; panel.value = value;
}
function closePanel() { panel.value = null; }
function onDialogClose() { if (!dialog.value?.open) closePanel(); }
watch([panel, compact], async () => {
  await nextTick();
  if (compact.value && panel.value && dialog.value && !dialog.value.open) dialog.value.showModal();
  else if (dialog.value?.open) {
    dialog.value.close();
    if (panelTrigger?.isConnected) panelTrigger.focus();
  }
});
let timer: ReturnType<typeof setInterval>, media: MediaQueryList;
function measureTimeline() {
  if (!mapWorkspace.value || !timeline.value || immersive.value) return;
  const bounds = mapWorkspace.value.getBoundingClientRect();
  timelineBounds.value = { left: bounds.left, width: bounds.width };
  timelineHeight.value = timeline.value.offsetHeight;
  const app = mapWorkspace.value.closest<HTMLElement>('.atlas-app')!;
  const appStyle = getComputedStyle(app);
  const overhead = [...mapWorkspace.value.querySelectorAll<HTMLElement>('.map-toolbar,.mobile-toolbar,.explore-toolbar,.map-footer,.notice,.panel-error')].reduce((height, element) => height + element.offsetHeight, 0);
  mobileMapHeight.value = Math.max(420, window.innerHeight - overhead - timelineHeight.value - parseFloat(appStyle.paddingTop) - parseFloat(appStyle.paddingBottom) - 2);
}
function mobilePresentationChange() { mobilePresentation.value = nativeIos || mobileMedia.matches; void nextTick(measureTimeline); }
watch(immersive, async value => { if (value) panel.value = null; await nextTick(); measureTimeline(); });
function layoutChange() { compact.value = media.matches; panel.value = null; void nextTick(measureTimeline); }
function sharedHashChange() {
  if (!nativeIos && new URLSearchParams(window.location.hash.slice(1)).has('scene')) {
    cancelPlayback(); window.location.reload();
  }
}
let removeAppActivity = () => {};
onMounted(() => {
  window.addEventListener('hashchange', sharedHashChange);
  removeAppActivity = listenAppActivity(active => {
    appActive.value = active;
    if (!active) cancelPlayback();
    else { refreshLimits(); setSystemAppearance(darkMode.value, immersive.value); }
  });
  mobileMedia.addEventListener('change', mobilePresentationChange);
  media = window.matchMedia('(max-width: 1099px)'); layoutChange(); media.addEventListener('change', layoutChange);
  layoutObserver = new ResizeObserver(entries => {
    for (const entry of entries) if (entry.target === mapWorkspace.value) mapWidth.value = entry.contentRect.width;
    measureTimeline();
  });
  if (mapWorkspace.value) layoutObserver.observe(mapWorkspace.value);
  if (timeline.value) layoutObserver.observe(timeline.value);
  for (const element of mapWorkspace.value?.querySelectorAll('.map-toolbar,.explore-toolbar,.map-footer') ?? []) layoutObserver.observe(element);
  measureTimeline(); window.addEventListener('resize', measureTimeline);
  prepareTerms(); void initialize(); timer = setInterval(refreshLimits, 30000);
  document.addEventListener('visibilitychange', refreshLimits);
});
watch([notice,presetError,presetBusy], async () => { await nextTick(); measureTimeline(); });
onBeforeUnmount(() => {
  cancelPlaybackPreparation();
  window.removeEventListener('hashchange', sharedHashChange);
  removeAppActivity(); setSystemAppearance(darkMode.value, false);
  layoutObserver?.disconnect(); mobileMedia.removeEventListener('change', mobilePresentationChange);
  ++initialization; clearInitialCalculations(); clearInterval(timer); media?.removeEventListener('change', layoutChange);
  document.removeEventListener('visibilitychange', refreshLimits);
  window.removeEventListener('resize', measureTimeline);
});
</script>
<template>
  <main class="atlas-app" :class="{'stacked-comparison':stackedComparison,'mobile-presentation':mobilePresentation,'immersive':immersive}">
    <audio ref="playbackAudio" :src="pianoUrl" loop preload="none" hidden></audio>
    <div class="workspace">
      <section ref="mapWorkspace" class="map-workspace" :data-fullscreen="fullscreenMode" :style="{'--mobile-map-height':`${mobileMapHeight}px`}" aria-label="中国昼夜观测台">
        <header class="map-toolbar" :class="{'with-page-actions':compact}">
          <div class="brand">
            <span class="brand-symbol" aria-hidden="true"><UiIcon name="sun" /></span>
            <div class="map-title"><span class="eyebrow">日光观测台</span><h1>中国昼夜地图</h1></div>
          </div>
          <HeaderActions v-if="compact" :dark="darkMode" @theme="toggleTheme" @about="about?.open($event)" />
          <MapClock :minute="minute" :playing="playing" :ready="ready" :music-enabled="musicEnabled" @toggle="togglePlayback" @music="toggleMusic" @edit="openTimeSetting" />
        </header>
        <div v-if="compact" class="mobile-toolbar">
          <button aria-label="地区详情" :class="{'has-selection':selected}" @click="openPanel('region',$event)"><UiIcon name="pin" />地区详情<span v-if="selected" class="selected-name">{{selected.name}}</span></button>
          <button @click="openPanel('date',$event)"><UiIcon name="calendar" />日期与节气</button>
        </div>
        <nav class="explore-toolbar" aria-label="精选观测场景" :aria-busy="presetBusy">
          <div class="explore-actions">
          <button :disabled="!shape||!!dataError||!appActive" :aria-pressed="activePreset==='morning'" @click="selectPreset('morning')">看晨光</button>
          <button :disabled="!shape||!!dataError||!appActive" :aria-pressed="activePreset==='solstices'" @click="selectPreset('solstices')">冬夏对比</button>
          <button :disabled="!shape||!!dataError||!appActive" :aria-pressed="activePreset==='now'" @click="selectPreset('now')">看此刻</button>
          <button v-if="!nativeIos" :disabled="!mapsReady||presetBusy" @click="openShare">分享</button>
          </div>
          <p class="explore-feedback" :role="presetBusy||presetError||presetNotice ? (presetError?'alert':'status') : undefined">{{presetBusy?'正在准备观测场景…':presetError||presetNotice}}</p>
        </nav>
        <div v-if="notice" class="notice" role="status">{{notice}}<button class="icon-button" aria-label="关闭提示" @click="notice=''"><UiIcon name="close" /></button></div>
        <div v-if="musicEnabled && audioError" class="notice audio-notice" role="status"><span>{{audioError}}</span><button :disabled="!playing" @click="retryAudio">重试音乐</button></div>
        <div v-if="dataError" class="panel-error" role="alert">{{dataError}}<button @click="initialize">重试全国数据</button></div>
        <div class="maps" :class="{comparing:compare,'scene-changing':sceneChanging}" :aria-busy="presetBusy">
          <MapPane v-for="(date,i) in dates" ref="mapPanes" :key="i" :number="i" :date="date" :solar-term="dateTerms[i] ?? null" :minute="minute" :vector="vectors[i]" :selected="selected" :camera="camera" :show-inset="!mobilePresentation" :compact-labels="mobilePresentation" :immersive="immersive" :comparison-align="immersive && compare && mobilePresentation ? (i===0?'bottom':'top') : 'center'" @select="selectFromMap" @camera="camera=$event" @status="onStatus(i,$event)" />
          <div class="map-view-controls" aria-label="地图显示操作">
            <button v-if="immersive" class="map-play-button" :disabled="!ready" :aria-label="playing?'暂停播放':'开始播放'" :aria-pressed="playing" @click="togglePlayback"><UiIcon :name="playing?'pause':'play'" /></button>
            <button v-if="immersive" aria-label="退出全屏" title="退出全屏" @click="exitFullscreen"><UiIcon name="close" /></button>
            <button v-else aria-label="全屏查看地图" title="全屏查看地图" :disabled="!mapsReady||presetBusy||fullscreenPending" @click="enterFullscreen"><UiIcon name="extent" /></button>
          </div>
          <div v-if="immersive && phaseError" class="map-error" role="alert"><span>{{phaseError}}</span><button @click="retryCalculations">重试播放计算</button></div>
        </div>
        <footer class="map-footer">
          <span class="map-hint"><UiIcon name="pin" />点击省份，查看当地日光</span>
          <div class="legend" aria-label="昼夜图例"><span><i class="day"></i>白天</span><span><i class="night"></i>黑夜</span></div>
        </footer>
        <div class="timeline-space" aria-hidden="true" :style="{height:`${timelineHeight}px`}"></div>
      </section>
      <aside v-if="!compact" class="observation-rail" :inert="immersive" aria-label="日期与地区观测">
        <div class="rail-heading"><h2>观测记录</h2><HeaderActions :dark="darkMode" @theme="toggleTheme" @about="about?.open($event)" /></div>
        <SolarTermPanel :dates="dates" :min="limits.min" :max="limits.max" :today="today" :year="termYear" :compare="compare" :target="target" :terms="terms" :selected="!!selected" :disabled="dataLoading||!!dataError||!segments.length" :error="phaseError||termError" @date="setDate" @compare="toggleCompare" @target="target=$event" @term="selectTerm" @retry="retryCalculations">
          <Transition name="details" mode="out-in" @after-enter="restoreDetailsFocus">
            <section v-if="selected && detailsOpen" class="details-card" key="open">
              <div class="details-heading"><span>地区观测</span><button class="icon-button" aria-label="关闭地区详情" @click="setDetailsOpen(false)"><UiIcon name="close" /></button></div>
              <RegionDetails :region="selected" :index="index" :days="observationDays" :summary="summary" :vectors="vectors" :ready="ready" @select="select" @event="seekEvent" />
            </section>
            <button v-else-if="selected" class="details-reopen" key="closed" aria-label="地区详情" @click="setDetailsOpen(true)"><span>{{selected.name}} · 地区详情</span><UiIcon name="arrow" /></button>
          </Transition>
        </SolarTermPanel>
      </aside>
    </div>
    <div v-show="!immersive" ref="timeline" class="fixed-timeline" :style="{left:`${timelineBounds.left}px`,width:`${timelineBounds.width}px`}">
      <TimeScrubber :minute="minute" :ready="ready" @scrubstart="startScrubbing" @seek="seekMinute" />
    </div>
    <dialog v-if="compact" ref="dialog" class="mobile-dialog" :aria-label="panel==='region'?'地区详情':'日期与节气'" @cancel.prevent="closePanel" @close="onDialogClose">
      <div ref="calendarHost" class="calendar-popup-host"></div>
      <template v-if="panel">
        <div class="dialog-heading"><span>{{panel==='region'?'地区详情':'日期与节气'}}</span><button class="icon-button" autofocus aria-label="关闭面板" @click="closePanel"><UiIcon name="close" /></button></div>
        <RegionDetails v-if="panel==='region'" :region="selected" :index="index" :days="observationDays" :summary="summary" :vectors="vectors" :ready="ready" @select="select" @event="seekEvent" />
        <SolarTermPanel v-else :popup-host="calendarHost" :dates="dates" :min="limits.min" :max="limits.max" :today="today" :year="termYear" :compare="compare" :target="target" :terms="terms" :selected="!!selected" :disabled="dataLoading||!!dataError||!segments.length" :error="phaseError||termError" @date="setDate" @compare="toggleCompare" @target="target=$event" @term="selectTerm" @retry="retryCalculations" />
      </template>
    </dialog>
    <TimeSettingDialog ref="timeSetting" :minute="minute" :dates="dates" @seek="seekMinute" />
    <ShareSceneDialog v-if="!nativeIos" ref="shareDialog" />
    <AboutDialog v-if="nativeIos" ref="about" />
  </main>
</template>
