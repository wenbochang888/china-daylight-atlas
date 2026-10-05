<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import maplibregl, { type Map as LibreMap } from 'maplibre-gl';
import type { Camera, Region, SunVector } from '../domain/types';
import { MAX_BROWSE_ZOOM } from '../data/map-repository';
import { formatMinute } from '../domain/beijing-time';
import { emptyCollection, highlight, installLayers, mapStyle, resizeProvinceLabels } from '../map/layers';
import { nationalPresentation } from '../map/national-presentation';
import type { SolarLayer } from '../map/solar-layer';

const props = defineProps<{ date: string; minute: number; vector: SunVector; selected: Region | null; camera: Camera | null; number: number; showInset: boolean; compactLabels: boolean; immersive: boolean }>();
const emit = defineEmits<{ select: [id: string]; camera: [value: Camera]; status: [value: 'loading'|'ready'|'error'] }>();
const container = ref<HTMLDivElement>(), insetContainer = ref<HTMLDivElement>(), timeCard = ref<HTMLDivElement>();
const loading = ref(true), error = ref(''), timePoint = ref({ x: 0, y: 0 });
const narrowMap = ref(false);
let map: LibreMap | undefined, inset: LibreMap | undefined;
let solar: SolarLayer | undefined, insetSolar: SolarLayer | undefined;
let resizeObserver: ResizeObserver | undefined;
let syncing = false, generation = 0, disposed = false, renderFailed = false, mainReady = false, insetReady = false;
let nationalBounds: [[number, number], [number, number]] = [[73.5, 18.16], [135.09, 53.56]];
let provinceCenters = new Map<string, [number,number]>();
let provinceLabels = emptyCollection;
let labelPositions = new Map<string,{x:number;y:number}>();
const hitLayers = ['key-province-labels', 'taiwan-label', 'labels-province', 'province-fill'];
function provinceAt(point: { x: number; y: number }) {
  if (!map || loading.value || renderFailed) return undefined;
  const exact = map.queryRenderedFeatures([point.x,point.y], { layers: hitLayers });
  // Tiny provinces may occupy less than a CSS pixel. Give their original faces
  // a three-pixel hit margin, resolving nearby HK/Macao by their label anchors.
  const nearby = map.queryRenderedFeatures([[point.x-3,point.y-3],[point.x+3,point.y+3]], { layers: ['province-fill'] });
  const small = nearby.filter(f => ['156810000','156820000'].includes(String(f.properties.id)));
  const distance = (id: string) => {
    const center = provinceCenters.get(id); if (!center || !map) return Infinity;
    const p = map.project(center); return Math.hypot(p.x-point.x,p.y-point.y);
  };
  small.sort((a,b) => distance(String(a.properties.id))-distance(String(b.properties.id)));
  const found = exact.find(f => f.layer.type === 'symbol') ?? small[0] ?? exact[0] ?? nearby[0];
  return found ? String(found.properties.id) : undefined;
}
function updateTimePosition() {
  if (!map || !container.value) return;
  const point = map.project([106, 49.5]);
  const halfWidth = (timeCard.value?.offsetWidth || 168)/2 + 8, halfHeight = (timeCard.value?.offsetHeight || 108)/2 + 8;
  timePoint.value = { x: Math.max(halfWidth, Math.min(container.value.clientWidth - halfWidth, point.x)),
    y: narrowMap.value ? halfHeight : Math.max(halfHeight, Math.min(container.value.clientHeight - halfHeight, point.y)) };
}
function updateLabels() { if (map && !loading.value && !renderFailed) labelPositions = resizeProvinceLabels(map, provinceLabels, props.compactLabels); }
function renderError(message: string) {
  renderFailed = true; ++generation; loading.value = false; error.value = message; emit('status','error');
}
function publishCamera() {
  if (!map || syncing || loading.value || renderFailed) return;
  const center = map.getCenter();
  emit('camera', { center: [center.lng, center.lat], zoom: map.getZoom(), maxZoom: map.getMaxZoom() });
}
function applyCamera(value: Camera) {
  if (!map) return;
  syncing = true; map.setMaxZoom(value.maxZoom); map.jumpTo({ center: value.center, zoom: value.zoom }); syncing = false;
  updateTimePosition(); void nextTick(updateLabels);
}
function fitNational() {
  if (!map || loading.value || renderFailed) return;
  syncing = true;
  const padding = props.compactLabels ? 16 : 24;
  const safeTop = props.immersive && timeCard.value ? parseFloat(getComputedStyle(timeCard.value).marginTop) || 0 : 0;
  const safe = props.immersive && container.value?.parentElement ? getComputedStyle(container.value.parentElement) : undefined;
  map.fitBounds(nationalBounds, { padding: narrowMap.value || props.immersive ? {top:(narrowMap.value ? (timeCard.value?.offsetHeight||108)+24 : padding)+safeTop,
    left:padding+(parseFloat(safe?.paddingLeft ?? '')||0),right:padding+(parseFloat(safe?.paddingRight ?? '')||0),bottom:padding+(parseFloat(safe?.paddingBottom ?? '')||0)} : padding, duration: 0 });
  syncing = false; updateTimePosition(); publishCamera();
  void nextTick(updateLabels);
}
function fitInset() { inset?.fitBounds([[104,2],[124,25]], { padding: 5, duration: 0 }); }
function finishLoading() {
  if (!map || !mainReady || (props.showInset && !insetReady) || disposed || renderFailed) return;
  loading.value = false; highlight(map, props.selected?.id ?? null);
  if (props.number === 0) fitNational();
  else if (props.camera) applyCamera(props.camera);
  else fitNational();
  void nextTick(updateTimePosition);
  emit('status','ready');
}
async function initialize() {
  loading.value = true; error.value = ''; disposed = false; renderFailed = false; mainReady = false; insetReady = false; emit('status','loading');
  const attempt = ++generation;
  try {
    const { islandLabels, main: presentation, provinceLabels: labels } = nationalPresentation();
    await nextTick();
    if (disposed || attempt !== generation || !container.value) return;
    nationalBounds = presentation.bounds; provinceLabels = labels;
    narrowMap.value = container.value.clientWidth < 600;
    provinceCenters = new Map(labels.features.flatMap(f => f.geometry.type === 'Point' ? [[String(f.properties?.id), f.geometry.coordinates.slice(0,2) as [number,number]] as const] : []));
    map = new maplibregl.Map({ container: container.value, style: structuredClone(mapStyle), center: [104,35], zoom: 3,
      minZoom: 0.5, maxZoom: MAX_BROWSE_ZOOM, interactive: false, renderWorldCopies: false,
      attributionControl: false, localIdeographFontFamily: 'sans-serif', canvasContextAttributes: { preserveDrawingBuffer: true } });
    const primaryMap = map;
    map.on('error', event => { if (map === primaryMap) renderError(event.error?.message ?? '地图渲染失败'); });
    map.on('load', () => {
      if (map !== primaryMap) return;
      try {
        solar = installLayers(primaryMap, presentation.provinces, presentation.boundaries, labels, islandLabels); solar.setVector(props.vector);
        primaryMap.once('idle', () => { if (map === primaryMap && !renderFailed) { mainReady = true; finishLoading(); } });
      } catch (cause) { renderError(`地图渲染失败：${String(cause)}`); }
    });
    map.on('click', event => {
      if (map !== primaryMap || loading.value || renderFailed || props.immersive) return;
      const id = provinceAt(event.point);
      if (id) emit('select', id);
    });
    map.on('mousemove', event => {
      if (map === primaryMap && !loading.value && !renderFailed)
        map.getCanvas().style.cursor = !props.immersive && provinceAt(event.point) ? 'pointer' : '';
    });
    map.getCanvas().addEventListener('webglcontextlost', () => { if (map === primaryMap) renderError('图形上下文已丢失，请重试加载。'); });
    createInset();
    resizeObserver = new ResizeObserver(refreshLayout);
    resizeObserver.observe(container.value);
  } catch (cause) { renderError(`地图初始化失败：${cause instanceof Error ? cause.message : String(cause)}`); }
}
function createInset() {
  if (!props.showInset || !insetContainer.value || inset || disposed || renderFailed) return;
  const { provinces, boundaries, islandLabels } = nationalPresentation();
  const insetMap = new maplibregl.Map({ container: insetContainer.value, style: structuredClone(mapStyle), center: [113.5,13], zoom: 2.1,
    interactive: false, attributionControl: false, renderWorldCopies: false, localIdeographFontFamily: 'sans-serif' });
  inset = insetMap; insetReady = false;
  insetMap.on('error', event => { if (inset === insetMap) renderError(`南海附图渲染失败：${event.error?.message ?? '请重试'}`); });
  insetMap.getCanvas().addEventListener('webglcontextlost', () => { if (inset === insetMap) renderError('南海附图图形上下文已丢失，请重试加载。'); });
  insetMap.on('load', () => {
    if (inset !== insetMap || disposed || renderFailed) return;
    try {
      insetSolar = installLayers(insetMap, provinces, boundaries, emptyCollection, islandLabels, true); insetSolar.setVector(props.vector);
      fitInset(); insetMap.once('idle', () => {
        if (inset === insetMap && !renderFailed) { insetReady = true; if (loading.value) finishLoading(); }
      });
    } catch (cause) { renderError(`南海附图渲染失败：${String(cause)}`); }
  });
}
function removeInset() {
  const previous = inset; inset = undefined; insetSolar = undefined; insetReady = false; previous?.remove();
}
function refreshLayout() {
  narrowMap.value = !!container.value && container.value.clientWidth < 600;
  map?.resize(); inset?.resize();
  if (!loading.value && !renderFailed) {
    fitInset();
    if (props.number === 0) fitNational(); else { updateTimePosition(); void nextTick(updateLabels); }
  }
}
watch(() => props.showInset, async value => {
  if (!value) { removeInset(); if (loading.value) finishLoading(); }
  await nextTick();
  if (disposed || renderFailed || !map) return;
  try { if (props.showInset) createInset(); refreshLayout(); }
  catch (cause) { renderError(`南海附图初始化失败：${String(cause)}`); }
});
watch([() => props.compactLabels, () => props.immersive], async () => {
  await nextTick();
  if (disposed || renderFailed) return;
  if (map) map.getCanvas().style.cursor = '';
  refreshLayout();
});
function cleanup() {
  disposed = true; ++generation; resizeObserver?.disconnect();
  const previousMap = map; map = undefined; solar = undefined; removeInset();
  previousMap?.remove();
}
function retry() { cleanup(); void initialize(); }
watch(() => props.vector, value => { solar?.setVector(value); insetSolar?.setVector(value); });
watch(() => props.selected?.id, () => { if (map && solar && !renderFailed) highlight(map, props.selected?.id ?? null); });
watch(() => props.camera, value => {
  if (!map || loading.value || renderFailed || !value) return;
  const center = map.getCenter();
  if (Math.abs(center.lng-value.center[0])+Math.abs(center.lat-value.center[1]) < 0.00001 &&
      Math.abs(map.getZoom()-value.zoom) < 0.00001 && Math.abs(map.getMaxZoom()-value.maxZoom) < 0.00001) return;
  applyCamera(value);
});
onMounted(initialize); onBeforeUnmount(cleanup);
defineExpose({ isLoaded: () => !!map?.loaded(), getView: () => map ? { center: map.getCenter().toArray(), zoom: map.getZoom(), maxZoom: map.getMaxZoom(), bounds: map.getBounds().toArray() } : null,
  projectPoint: (point: [number,number]) => map?.project(point),
  getProvinceLabelPoint: (id: string) => labelPositions.get(id) ?? null,
  getProvinceLabels: () => map?.queryRenderedFeatures(undefined, { layers: ['labels-province','key-province-labels','taiwan-label'] }).map(f => String(f.properties.id)) ?? [],
  getProvinceLabelStyles: () => ['labels-province','key-province-labels','taiwan-label'].map(id => ({id, text:map?.getLayoutProperty(id,'text-field'), size:map?.getLayoutProperty(id,'text-size')})),
  getInsetLabels: () => inset?.queryRenderedFeatures(undefined, { layers: ['island-groups','island-names'] }).map(f => String(f.properties.name)) ?? [] });
</script>

<template>
  <section class="map-pane" :class="{'narrow-map':narrowMap,'without-inset':!showInset,'immersive-pane':immersive}" :aria-label="`${date} 昼夜地图`">
    <div ref="container" class="map-canvas" :data-map="number"></div>
    <div v-if="!loading && !error" ref="timeCard" class="map-time" :aria-hidden="!immersive" :style="{left:`${timePoint.x}px`,top:`${timePoint.y}px`}">
      <time class="map-day" :datetime="date">{{date.replaceAll('-','.')}}</time>
      <div class="map-time-value"><span>北京时间</span><strong data-testid="map-clock">{{formatMinute(minute)}}</strong></div>
    </div>
    <div v-if="showInset" class="south-sea" aria-label="南海诸岛附图"><div class="inset-title">南海诸岛</div><div ref="insetContainer" class="inset-canvas"></div></div>
    <div v-if="loading" class="map-message" role="status"><span class="spinner"></span>正在准备地图…</div>
    <div v-if="error" class="map-error" role="alert"><span>{{error}}</span><button @click="retry">重试</button></div>
  </section>
</template>
