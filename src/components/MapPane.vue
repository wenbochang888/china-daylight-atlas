<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import maplibregl, { type Map as LibreMap } from 'maplibre-gl';
import type { Camera, Region, SunVector } from '../domain/types';
import { MAX_BROWSE_ZOOM } from '../data/map-repository';
import { formatMinute } from '../domain/beijing-time';
import { emptyCollection, highlight, installLayers, mapStyle, resizeProvinceLabels } from '../map/layers';
import { nationalPresentation } from '../map/national-presentation';
import type { SolarLayer } from '../map/solar-layer';
import { comparisonOffset, type ComparisonAlignment } from '../map/comparison-layout';

const props = defineProps<{ date: string; solarTerm: string | null; minute: number; vector: SunVector; selected: Region | null; camera: Camera | null; number: number; showInset: boolean; compactLabels: boolean; immersive: boolean; comparisonAlign: ComparisonAlignment }>();
const emit = defineEmits<{ select: [id: string]; camera: [value: Camera]; status: [value: 'loading'|'ready'|'error'] }>();
const container = ref<HTMLDivElement>(), insetContainer = ref<HTMLDivElement>(), timeCard = ref<HTMLDivElement>();
const loading = ref(true), error = ref(''), timePoint = ref({ x: 0, y: 0 });
const narrowMap = ref(false);
const alignment = ref<ComparisonAlignment>('center');
let map: LibreMap | undefined, inset: LibreMap | undefined;
let solar: SolarLayer | undefined, insetSolar: SolarLayer | undefined;
let resizeObserver: ResizeObserver | undefined;
let syncing = false, generation = 0, disposed = false, renderFailed = false, mainReady = false, insetReady = false;
let nationalBounds: [[number, number], [number, number]] = [[73.5, 18.16], [135.09, 53.56]];
let provinceCenters = new Map<string, [number,number]>();
let provinceLabels = emptyCollection;
let provinceGeometry = emptyCollection;
let islandAnnotations = emptyCollection;
let labelPositions: ReturnType<typeof resizeProvinceLabels> = new Map();
let layoutGeneration = 0;
const presentationWaiters = new Set<() => void>();
let cancelPresentationIdle = () => {};
function finishPresentation() {
  cancelPresentationIdle();
  for (const resolve of presentationWaiters) resolve();
  presentationWaiters.clear();
}
function whenPresented() {
  if (disposed || renderFailed) return Promise.resolve();
  return new Promise<void>(resolve => {
    presentationWaiters.add(resolve);
    if (!loading.value) void arrangeScene();
  });
}
const zeroPadding = { top: 0, bottom: 0, left: 0, right: 0 };
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
  const north = map.project(nationalBounds[1]);
  timePoint.value = { x: container.value.clientWidth / 2, y: north.y - (props.compactLabels || narrowMap.value ? 12 : 16) };
}
function updateLabels() { if (map && !loading.value && !renderFailed) labelPositions = resizeProvinceLabels(map, provinceLabels, props.compactLabels, provinceGeometry, islandAnnotations); }
function sceneBounds() {
  if (!map || !timeCard.value) return { top: 0, bottom: 0 };
  const top = Math.min(map.project(nationalBounds[1]).y, timePoint.value.y-timeCard.value.offsetHeight,
    ...[...labelPositions.values()].map(position => position.box.top));
  let bottom = Math.max(map.project(nationalBounds[0]).y + 2, timePoint.value.y,
    ...[...labelPositions.values()].map(position => position.box.bottom));
  const diaoyu = islandAnnotations.features.find(f => f.properties?.kind === 'diaoyu-group' && f.geometry.type === 'Point');
  if (diaoyu?.geometry.type === 'Point') {
    const offset = map.getLayoutProperty('diaoyu-group','text-offset') as [number,number];
    bottom = Math.max(bottom, map.project(diaoyu.geometry.coordinates.slice(0,2) as [number,number]).y + offset[1]*11 + 10);
  }
  return { top, bottom };
}
async function arrangeScene() {
  const attempt = ++layoutGeneration;
  updateTimePosition(); await nextTick();
  if (!map || disposed || renderFailed || attempt !== layoutGeneration) return;
  updateLabels();
  if (alignment.value !== 'center' && container.value && timeCard.value) {
    const canvas = container.value.getBoundingClientRect();
    const safe = getComputedStyle(container.value.parentElement!);
    const card = timeCard.value.getBoundingClientRect();
    const controls = container.value.closest('.maps')?.querySelector('.map-view-controls')?.getBoundingClientRect();
    let top = 12 + (parseFloat(safe.paddingTop) || 0);
    if (controls && card.left < controls.right+8 && card.right > controls.left-8 && controls.bottom > canvas.top && controls.top < canvas.bottom)
      top = Math.max(top, controls.bottom-canvas.top+8);
    const available = { top, bottom: canvas.height-12-(parseFloat(safe.paddingBottom)||0) };
    let shift = 0;
    // Re-measure after label placement; a second pass accounts for viewport-edge callouts.
    for (let pass = 0; pass < 2; pass++) {
      const delta = comparisonOffset(alignment.value, sceneBounds(), available);
      if (Math.abs(delta) < 0.5) break;
      shift += delta;
      map.setPadding({ ...zeroPadding, top: Math.max(0,shift*2), bottom: Math.max(0,-shift*2) });
      updateTimePosition(); await nextTick();
      if (!map || disposed || renderFailed || attempt !== layoutGeneration) return;
      updateLabels();
    }
  }
  await nextTick();
  if (!map || disposed || renderFailed || attempt !== layoutGeneration || !presentationWaiters.size) return;
  cancelPresentationIdle();
  const current = map;
  const presented = () => { if (attempt === layoutGeneration) finishPresentation(); };
  cancelPresentationIdle = () => { current.off('idle', presented); cancelPresentationIdle = () => {}; };
  current.once('idle', presented); current.triggerRepaint();
}
function renderError(message: string) {
  renderFailed = true; ++generation; loading.value = false; error.value = message; emit('status','error');
  finishPresentation();
}
function publishCamera() {
  if (!map || syncing || loading.value || renderFailed) return;
  const center = map.getCenter();
  emit('camera', { center: [center.lng, center.lat], zoom: map.getZoom(), maxZoom: map.getMaxZoom() });
}
function applyCamera(value: Camera) {
  if (!map) return;
  syncing = true; map.setMaxZoom(value.maxZoom); map.jumpTo({ center: value.center, zoom: value.zoom, padding: zeroPadding }); syncing = false;
  void arrangeScene();
}
function fitNational() {
  if (!map || loading.value || renderFailed) return;
  syncing = true;
  map.setPadding(zeroPadding);
  const padding = props.compactLabels ? 16 : 24;
  const safe = props.immersive && container.value?.parentElement ? getComputedStyle(container.value.parentElement) : undefined;
  const safeTop = parseFloat(safe?.paddingTop ?? '') || 0;
  // Measure both information groups: comparison keeps one camera even when only one day is a term.
  const groups = [...container.value?.closest('.maps')?.querySelectorAll<HTMLElement>('.map-info') ?? []];
  const controls = container.value?.closest('.maps')?.querySelector('.map-view-controls')?.getBoundingClientRect();
  let header = 0;
  const alignedPadding: Array<{top:number;bottom:number;left:number;right:number}> = [];
  for (const group of groups) {
    const canvas = group.parentElement?.querySelector('.map-canvas')?.getBoundingClientRect();
    if (!canvas) continue;
    const left = canvas.left + (canvas.width - group.offsetWidth) / 2;
    const overlaps = controls && left < controls.right + 8 && left + group.offsetWidth > controls.left - 8;
    const top = overlaps ? Math.max(padding + safeTop, controls.bottom - canvas.top + 8) : padding + safeTop;
    header = Math.max(header, top + group.offsetHeight);
    if (alignment.value !== 'center' && group.parentElement && container.value) {
      const paneStyle = getComputedStyle(group.parentElement);
      const paneTop = Math.max(12+(parseFloat(paneStyle.paddingTop)||0), overlaps ? controls!.bottom-canvas.top+8 : 0);
      alignedPadding.push({top:paneTop+group.offsetHeight+12,
        // Reserve the outline stroke and subpixel rounding before targeting a 12px scene gap.
        bottom:16+(parseFloat(paneStyle.paddingBottom)||0)+Math.max(0,container.value.clientHeight-canvas.height),
        left:padding+(parseFloat(paneStyle.paddingLeft)||0),right:padding+(parseFloat(paneStyle.paddingRight)||0)});
    }
  }
  if (alignedPadding.length) {
    // Each half has its own outside safe area. Use the tighter fit, without adding both halves' insets together.
    const zoom = Math.min(...alignedPadding.map(padding => map!.cameraForBounds(nationalBounds,{padding})?.zoom ?? map!.getZoom()));
    const fitted = map.cameraForBounds(nationalBounds,{padding:alignedPadding[0],maxZoom:zoom});
    if (fitted) map.jumpTo({...fitted,padding:zeroPadding});
  } else map.fitBounds(nationalBounds, { padding: {top:header + (props.compactLabels || narrowMap.value ? 12 : 16),
    left:padding+(parseFloat(safe?.paddingLeft ?? '')||0),right:padding+(parseFloat(safe?.paddingRight ?? '')||0),bottom:padding+(parseFloat(safe?.paddingBottom ?? '')||0)}, duration: 0 });
  syncing = false; publishCamera();
  void arrangeScene();
}
function fitInset() { inset?.fitBounds([[104,2],[124,25]], { padding: 5, duration: 0 }); }
function finishLoading() {
  if (!map || !mainReady || (props.showInset && !insetReady) || disposed || renderFailed) return;
  loading.value = false; highlight(map, props.selected?.id ?? null);
  if (props.number === 0) fitNational();
  else if (props.camera) applyCamera(props.camera);
  else fitNational();
  void nextTick(refreshLayout);
  emit('status','ready');
}
async function initialize() {
  loading.value = true; error.value = ''; disposed = false; renderFailed = false; mainReady = false; insetReady = false; emit('status','loading');
  const attempt = ++generation;
  try {
    const { islandLabels, main: presentation, provinceLabels: labels } = nationalPresentation();
    await nextTick();
    if (disposed || attempt !== generation || !container.value) return;
    nationalBounds = presentation.bounds; provinceLabels = labels; provinceGeometry = presentation.provinces; islandAnnotations = islandLabels;
    narrowMap.value = container.value.clientWidth < 600;
    provinceCenters = new Map(labels.features.flatMap(f => f.geometry.type === 'Point' ? [[String(f.properties?.id), f.geometry.coordinates.slice(0,2) as [number,number]] as const] : []));
    map = new maplibregl.Map({ container: container.value, style: structuredClone(mapStyle), center: [104,35], zoom: 3,
      minZoom: 0.5, maxZoom: MAX_BROWSE_ZOOM, interactive: false, renderWorldCopies: false,
      attributionControl: false, localIdeographFontFamily: 'sans-serif', fadeDuration: 0, canvasContextAttributes: { preserveDrawingBuffer: true } });
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
    if (timeCard.value) resizeObserver.observe(timeCard.value);
  } catch (cause) { renderError(`地图初始化失败：${cause instanceof Error ? cause.message : String(cause)}`); }
}
function createInset() {
  if (!props.showInset || !insetContainer.value || inset || disposed || renderFailed) return;
  const { provinces, boundaries, islandLabels } = nationalPresentation();
  const insetMap = new maplibregl.Map({ container: insetContainer.value, style: structuredClone(mapStyle), center: [113.5,13], zoom: 2.1,
    interactive: false, attributionControl: false, renderWorldCopies: false, localIdeographFontFamily: 'sans-serif', fadeDuration: 0 });
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
  alignment.value = window.matchMedia('(orientation: portrait)').matches ? props.comparisonAlign : 'center';
  map?.resize(); inset?.resize();
  if (!loading.value && !renderFailed) {
    fitInset();
    if (props.number === 0) fitNational(); else if (props.camera) applyCamera(props.camera);
  }
}
watch(() => props.showInset, async value => {
  if (!value) { removeInset(); if (loading.value) finishLoading(); }
  await nextTick();
  if (disposed || renderFailed || !map) return;
  try { if (props.showInset) createInset(); refreshLayout(); }
  catch (cause) { renderError(`南海附图初始化失败：${String(cause)}`); }
});
watch([() => props.compactLabels, () => props.immersive, () => props.comparisonAlign], async () => {
  await nextTick();
  if (disposed || renderFailed) return;
  if (map) map.getCanvas().style.cursor = '';
  refreshLayout();
});
function cleanup() {
  disposed = true; ++generation; ++layoutGeneration; resizeObserver?.disconnect();
  finishPresentation();
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
defineExpose({ whenPresented, isLoaded: () => !!map?.loaded(), getView: () => map ? { center: map.getCenter().toArray(), zoom: map.getZoom(), maxZoom: map.getMaxZoom(), bounds: map.getBounds().toArray() } : null,
  projectPoint: (point: [number,number]) => map?.project(point),
  getOutlineTop: () => map?.project(nationalBounds[1]).y,
  getSceneBounds: sceneBounds,
  getProvinceLabelPoint: (id: string) => labelPositions.get(id) ?? null,
  getProvinceLabelLayout: () => [...labelPositions].map(([id,position])=>({id,...position})),
  getProvinceAtPoint: (point: {x:number;y:number}) => map?.queryRenderedFeatures([point.x,point.y],{layers:['province-fill']})[0]?.properties.id,
  getDiaoyuText: () => map?.getLayoutProperty('diaoyu-group','text-field'),
  getProvinceLabels: () => map?.queryRenderedFeatures(undefined, { layers: ['labels-province','key-province-labels','taiwan-label'] }).map(f => String(f.properties.id)) ?? [],
  getProvinceLabelStyles: () => ['labels-province','key-province-labels','taiwan-label'].map(id => ({id, text:map?.getLayoutProperty(id,'text-field'), size:map?.getLayoutProperty(id,'text-size')})),
  getInsetLabels: () => inset?.queryRenderedFeatures(undefined, { layers: ['island-groups','island-names'] }).map(f => String(f.properties.name)) ?? [] });
</script>

<template>
  <section class="map-pane" :class="{'narrow-map':narrowMap,'without-inset':!showInset,'immersive-pane':immersive}" :data-comparison-align="alignment" :aria-label="`${date} 昼夜地图`">
    <div ref="container" class="map-canvas" :data-map="number"></div>
    <div ref="timeCard" class="map-info" :aria-hidden="loading || !!error" :style="{left:`${timePoint.x}px`,top:`${timePoint.y}px`,visibility:loading||error?'hidden':'visible'}">
      <div class="map-time">
        <time class="map-day" :datetime="date">{{date.replaceAll('-','.')}}<span v-if="solarTerm" class="map-solar-term" data-testid="map-solar-term">（{{solarTerm}}）</span></time>
        <div class="map-time-value"><span>北京时间</span><strong data-testid="map-clock">{{formatMinute(minute)}}</strong></div>
      </div>
    </div>
    <div v-if="showInset" class="south-sea" aria-label="南海诸岛附图"><div class="inset-title">南海诸岛</div><div ref="insetContainer" class="inset-canvas"></div></div>
    <div v-if="loading" class="map-message" role="status"><span class="spinner"></span>正在准备地图…</div>
    <div v-if="error" class="map-error" role="alert"><span>{{error}}</span><button @click="retry">重试</button></div>
  </section>
</template>
