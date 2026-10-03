<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import MapPane from './components/MapPane.vue';
import RegionDetails from './components/RegionDetails.vue';
import SolarTermPanel from './components/SolarTermPanel.vue';
import MapClock from './components/MapClock.vue';
import TimeScrubber from './components/TimeScrubber.vue';
import UiIcon from './components/UiIcon.vue';
import { beijingDate, clampDate, clampMinute, dateLimits, previousDate, toInstant } from './domain/beijing-time';
import { solarVector } from './domain/solar';
import { solarTermOptions } from './domain/solar-terms';
import { combinePlaybackSegments, nationalPlaybackSegments, playbackElapsedSeconds, prepareNationalGeometry, type NationalGeometry } from './domain/national-playback';
import { nationalMap } from './data/national-map';
import { usePlayback } from './composables/usePlayback';
import { usePlaybackAudio } from './composables/usePlaybackAudio';
import pianoUrl from './mp3/钢琴曲.mp3';
import type { Camera, PlaybackMultiplier, PlaybackSegment, Region, SolarTermOption } from './domain/types';

const now = new Date(), today = ref(beijingDate(now)), limits = ref(dateLimits(now)), dates = ref([today.value]), minute = ref(0);
const musicPreferenceKey = 'china-daylight-atlas:music-enabled';
function preferredMusic() { try { return localStorage.getItem(musicPreferenceKey) !== 'false'; } catch { return true; } }
const musicEnabled = ref(preferredMusic());
function toggleMusic() {
  musicEnabled.value = !musicEnabled.value;
  try { localStorage.setItem(musicPreferenceKey, String(musicEnabled.value)); } catch { /* The in-page preference remains usable. */ }
}
const termYear = computed(() => Number(today.value.slice(0,4)));
const regions = shallowRef<Region[]>([]), shape = shallowRef<NationalGeometry | null>(null);
const segments = shallowRef<PlaybackSegment[]>([]), terms = shallowRef<SolarTermOption[]>([]);
const index = computed(() => new Map(regions.value.map(region => [region.id, region])));
const selectedId = ref(''), selected = computed(() => index.value.get(selectedId.value) ?? null);
const camera = ref<Camera | null>(null), target = ref(0);
const compare = computed(() => dates.value.length === 2);
const vectors = computed(() => dates.value.map(date => solarVector(toInstant(date, minute.value))));
const playbackMultiplier = computed<PlaybackMultiplier>(() => 1);
const { playing, pause, start, toggle } = usePlayback(minute, segments, playbackMultiplier);
const playbackAudio = shallowRef<HTMLAudioElement>();
const playbackSeconds = computed(() => playbackElapsedSeconds(minute.value, segments.value, playbackMultiplier.value));
const { error: audioError, retry: retryAudio } = usePlaybackAudio(playbackAudio, playing, playbackSeconds, musicEnabled);
const dataError = ref(''), phaseError = ref(''), termError = ref(''), notice = ref('');
const dataLoading = ref(true), pendingPlay = ref(false);
const mapStates = ref<Array<'loading' | 'ready' | 'error'>>(['loading']);
const ready = computed(() => !dataLoading.value && !dataError.value && !phaseError.value && !!segments.value.length && dates.value.every((_, i) => mapStates.value[i] === 'ready'));
const detailsOpen = ref(false);
const mapWorkspace = ref<HTMLElement>(), mapWidth = ref(920);
const timeline = ref<HTMLElement>(), timelineBounds = ref({ left: 0, width: 0 }), timelineHeight = ref(84);
const stackedComparison = computed(() => compare.value && mapWidth.value < 920);
let layoutObserver: ResizeObserver | undefined;
let panelTrigger: HTMLElement | null = null;
let detailsFocusPending = false;
const compact = ref(false), panel = ref<'region' | 'date' | null>(null), dialog = ref<HTMLDialogElement>();
const calendarHost = ref<HTMLDivElement>();

function cancelPlayback() { pendingPlay.value = false; pause(); }
function prepareDates() {
  segments.value = []; phaseError.value = '';
  if (!shape.value) return;
  try { segments.value = combinePlaybackSegments(dates.value.map(date => nationalPlaybackSegments(date, shape.value!))); }
  catch { cancelPlayback(); phaseError.value = '全天播放区间计算失败，请重试。'; }
}
function prepareTerms() {
  termError.value = '';
  try { terms.value = solarTermOptions({ min: `${termYear.value}-01-01`, max: `${termYear.value}-12-31` }); }
  catch { termError.value = '节气日期计算失败，请重试。'; }
}
function setDate(i: number, value: string) {
  cancelPlayback(); const normalized = clampDate(value, limits.value);
  if (value !== normalized) notice.value = '日期已调整到两年观测范围内的有效日期。';
  dates.value[i] = normalized; prepareDates();
}
function toggleCompare() {
  cancelPlayback();
  if (compare.value) { dates.value = [dates.value[0]]; target.value = 0; mapStates.value = [mapStates.value[0]]; }
  else { dates.value = [dates.value[0], clampDate(previousDate(dates.value[0]), limits.value)]; mapStates.value.push('loading'); }
  prepareDates();
}
function selectTerm(term: SolarTermOption) {
  cancelPlayback();
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
  pendingPlay.value = false;
  toggle();
}
function seekMinute(value: number) { cancelPlayback(); minute.value = clampMinute(Math.round(value)); }
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
    cancelPlayback(); limits.value = next;
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
  if (!mapWorkspace.value || !timeline.value) return;
  const bounds = mapWorkspace.value.getBoundingClientRect();
  timelineBounds.value = { left: bounds.left, width: bounds.width };
  timelineHeight.value = timeline.value.offsetHeight;
}
function layoutChange() { compact.value = media.matches; panel.value = null; void nextTick(measureTimeline); }
onMounted(() => {
  media = window.matchMedia('(max-width: 1099px)'); layoutChange(); media.addEventListener('change', layoutChange);
  layoutObserver = new ResizeObserver(entries => {
    for (const entry of entries) if (entry.target === mapWorkspace.value) mapWidth.value = entry.contentRect.width;
    measureTimeline();
  });
  if (mapWorkspace.value) layoutObserver.observe(mapWorkspace.value);
  if (timeline.value) layoutObserver.observe(timeline.value);
  measureTimeline(); window.addEventListener('resize', measureTimeline);
  prepareTerms(); void initialize(); timer = setInterval(refreshLimits, 30000);
  document.addEventListener('visibilitychange', refreshLimits);
});
onBeforeUnmount(() => {
  layoutObserver?.disconnect();
  ++initialization; clearInitialCalculations(); clearInterval(timer); media?.removeEventListener('change', layoutChange);
  document.removeEventListener('visibilitychange', refreshLimits);
  window.removeEventListener('resize', measureTimeline);
});
</script>
<template>
  <main class="atlas-app" :class="{'stacked-comparison':stackedComparison}">
    <audio ref="playbackAudio" :src="pianoUrl" loop preload="none" hidden></audio>
    <div class="workspace">
      <section ref="mapWorkspace" class="map-workspace" aria-label="中国昼夜观测台">
        <header class="map-toolbar">
          <div class="brand">
            <span class="brand-symbol" aria-hidden="true"><UiIcon name="sun" /></span>
            <div class="map-title"><span class="eyebrow">日光观测台</span><h1>中国昼夜地图</h1></div>
          </div>
          <MapClock :minute="minute" :playing="playing" :ready="ready" :music-enabled="musicEnabled" @toggle="togglePlayback" @music="toggleMusic" />
        </header>
        <div v-if="compact" class="mobile-toolbar">
          <button aria-label="地区详情" :class="{'has-selection':selected}" @click="openPanel('region',$event)"><UiIcon name="pin" />地区详情<span v-if="selected" class="selected-name">{{selected.name}}</span></button>
          <button @click="openPanel('date',$event)"><UiIcon name="calendar" />日期与节气</button>
        </div>
        <div v-if="notice" class="notice" role="status">{{notice}}<button class="icon-button" aria-label="关闭提示" @click="notice=''"><UiIcon name="close" /></button></div>
        <div v-if="musicEnabled && audioError" class="notice audio-notice" role="status"><span>{{audioError}}</span><button :disabled="!playing" @click="retryAudio">重试音乐</button></div>
        <div v-if="dataError" class="panel-error" role="alert">{{dataError}}<button @click="initialize">重试全国数据</button></div>
        <div class="maps" :class="{comparing:compare}">
          <MapPane v-for="(date,i) in dates" :key="i" :number="i" :date="date" :minute="minute" :vector="vectors[i]" :selected="selected" :camera="camera" @select="selectFromMap" @camera="camera=$event" @status="onStatus(i,$event)" />
        </div>
        <footer class="map-footer">
          <span class="map-hint"><UiIcon name="pin" />点击省份，查看当地日光</span>
          <div class="legend" aria-label="昼夜图例"><span><i class="day"></i>白天</span><span><i class="night"></i>黑夜</span></div>
        </footer>
        <div class="timeline-space" aria-hidden="true" :style="{height:`${timelineHeight}px`}"></div>
      </section>
      <aside v-if="!compact" class="observation-rail" aria-label="日期与地区观测">
        <div class="rail-heading"><h2>观测记录</h2><UiIcon name="sun" /></div>
        <SolarTermPanel :dates="dates" :min="limits.min" :max="limits.max" :today="today" :year="termYear" :compare="compare" :target="target" :terms="terms" :disabled="dataLoading||!!dataError||!segments.length" :error="phaseError||termError" @date="setDate" @compare="toggleCompare" @target="target=$event" @term="selectTerm" @retry="retryCalculations">
          <Transition name="details" mode="out-in" @after-enter="restoreDetailsFocus">
            <section v-if="selected && detailsOpen" class="details-card" key="open">
              <div class="details-heading"><span>地区观测</span><button class="icon-button" aria-label="关闭地区详情" @click="setDetailsOpen(false)"><UiIcon name="close" /></button></div>
              <RegionDetails :region="selected" :index="index" :dates="dates" :vectors="vectors" @select="select" />
            </section>
            <button v-else-if="selected" class="details-reopen" key="closed" aria-label="地区详情" @click="setDetailsOpen(true)"><span>{{selected.name}} · 地区详情</span><UiIcon name="arrow" /></button>
          </Transition>
        </SolarTermPanel>
      </aside>
    </div>
    <div ref="timeline" class="fixed-timeline" :style="{left:`${timelineBounds.left}px`,width:`${timelineBounds.width}px`}">
      <TimeScrubber :minute="minute" :ready="ready" @scrubstart="cancelPlayback" @seek="seekMinute" />
    </div>
    <dialog v-if="compact" ref="dialog" class="mobile-dialog" :aria-label="panel==='region'?'地区详情':'日期与节气'" @cancel.prevent="closePanel" @close="onDialogClose">
      <div ref="calendarHost" class="calendar-popup-host"></div>
      <template v-if="panel">
        <div class="dialog-heading"><span>{{panel==='region'?'地区详情':'日期与节气'}}</span><button class="icon-button" autofocus aria-label="关闭面板" @click="closePanel"><UiIcon name="close" /></button></div>
        <RegionDetails v-if="panel==='region'" :region="selected" :index="index" :dates="dates" :vectors="vectors" @select="select" />
        <SolarTermPanel v-else :popup-host="calendarHost" :dates="dates" :min="limits.min" :max="limits.max" :today="today" :year="termYear" :compare="compare" :target="target" :terms="terms" :disabled="dataLoading||!!dataError||!segments.length" :error="phaseError||termError" @date="setDate" @compare="toggleCompare" @target="target=$event" @term="selectTerm" @retry="retryCalculations" />
      </template>
    </dialog>
  </main>
</template>
