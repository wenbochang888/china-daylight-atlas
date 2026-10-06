<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import UiIcon from './UiIcon.vue';
import ComparisonSummary from './ComparisonSummary.vue';
import { formatMinute } from '../domain/beijing-time';
import type { DayComparisonSummary, ObservationScene } from '../domain/types';
export interface ShareSnapshot { scene: ObservationScene; regionName: string; summary: DayComparisonSummary | null; url: string }
const dialog = ref<HTMLDialogElement>(), linkInput = ref<HTMLTextAreaElement>();
const snapshot = ref<ShareSnapshot>(), feedback = ref('');
let trigger: HTMLElement | null = null, revision = 0;
function open(event: Event, value: ShareSnapshot) {
  ++revision; trigger = event.currentTarget as HTMLElement; snapshot.value = value; feedback.value = ''; dialog.value?.showModal();
}
function close() { ++revision; dialog.value?.close(); }
async function copy(withDescription: boolean) {
  const value = snapshot.value; if (!value) return;
  const attempt = ++revision;
  const summary = value.summary ? `\n日期2相较日期1：昼长${value.summary.daylight}；日出${value.summary.sunrise}；日落${value.summary.sunset}。仅代表上述位置。` : '';
  const description = `中国昼夜地图 · ${value.regionName}\n${value.scene.dates.map((date,i)=>`日期${i+1}：${date}`).join('；')}\n北京时间 ${formatMinute(value.scene.minute)}${summary}\n${value.url}`;
  try {
    await navigator.clipboard.writeText(withDescription ? description : value.url);
    if (attempt === revision && dialog.value?.open) feedback.value = withDescription ? '说明与链接已复制' : '链接已复制';
  } catch {
    if (attempt !== revision || !dialog.value?.open) return;
    feedback.value = '暂时无法自动复制，请选中下方链接手动复制。'; linkInput.value?.focus(); linkInput.value?.select();
  }
}
function restoreFocus() { ++revision; if (trigger?.isConnected) trigger.focus({preventScroll:true}); }
onBeforeUnmount(close);
defineExpose({ open });
</script>
<template>
  <dialog ref="dialog" class="mobile-dialog share-scene-dialog" aria-labelledby="share-scene-title" @cancel.prevent="close" @close="restoreFocus">
    <div class="dialog-heading"><span id="share-scene-title">分享当前观测</span><button class="icon-button" autofocus aria-label="关闭分享" @click="close"><UiIcon name="close" /></button></div>
    <template v-if="snapshot">
      <p class="share-region">{{snapshot.regionName}}</p><p class="dialog-context">{{snapshot.scene.dates.join(' ／ ')}}<br>北京时间 {{formatMinute(snapshot.scene.minute)}}</p>
      <ComparisonSummary v-if="snapshot.summary" :summary="snapshot.summary" />
      <p class="dialog-context">打开链接可继续探索同一场景，初始保持暂停。</p>
      <label class="share-link-label">场景链接<textarea ref="linkInput" :value="snapshot.url" readonly aria-label="场景链接" rows="3" @focus="($event.target as HTMLTextAreaElement).select()" /></label>
      <div class="dialog-actions"><button @click="copy(false)">复制链接</button><button class="primary-action" @click="copy(true)">复制说明与链接</button></div>
      <p class="copy-feedback" role="status">{{feedback}}</p>
    </template>
  </dialog>
</template>
