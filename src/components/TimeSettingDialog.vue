<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import UiIcon from './UiIcon.vue';
import { timeInputMinute } from '../domain/observation';
const props = defineProps<{ minute: number; dates: string[] }>();
const emit = defineEmits<{ seek: [minute: number] }>();
const dialog = ref<HTMLDialogElement>(), hourInput = ref<HTMLInputElement>();
const hour = ref(''), minuteInput = ref(''), error = ref('');
let trigger: HTMLElement | null = null;
function open(event: Event) {
  trigger = event.currentTarget as HTMLElement;
  const value = Math.round(props.minute);
  hour.value = String(Math.floor(value/60)).padStart(2,'0'); minuteInput.value = String(value%60).padStart(2,'0'); error.value = '';
  dialog.value?.showModal(); void nextTick(() => { hourInput.value?.focus(); hourInput.value?.select(); });
}
function close() { dialog.value?.close(); }
function submit() {
  const value = timeInputMinute(hour.value, minuteInput.value);
  if (value === null) { error.value = '请输入00:00至23:59，或24:00；小时为24时，分钟必须为00。'; return; }
  emit('seek', value); close();
}
function restoreFocus() { if (trigger?.isConnected) trigger.focus({preventScroll:true}); }
onBeforeUnmount(close);
defineExpose({ open });
</script>
<template>
  <dialog ref="dialog" class="mobile-dialog time-setting-dialog" aria-labelledby="time-setting-title" @cancel.prevent="close" @close="restoreFocus">
    <form @submit.prevent="submit">
      <div class="dialog-heading"><span id="time-setting-title">设置北京时间</span><button type="button" class="icon-button" aria-label="关闭时间设置" @click="close"><UiIcon name="close" /></button></div>
      <p class="dialog-context">{{dates.join(' ／ ')}}<br v-if="dates.length===2"><span v-if="dates.length===2">两张地图使用同一时刻。</span></p>
      <div class="time-inputs"><label>小时<input ref="hourInput" v-model="hour" aria-label="小时" inputmode="numeric" maxlength="2" autocomplete="off" :aria-invalid="!!error" :aria-describedby="error?'time-setting-error':undefined" @input="error=''" /></label><span aria-hidden="true">:</span><label>分钟<input v-model="minuteInput" aria-label="分钟" inputmode="numeric" maxlength="2" autocomplete="off" :aria-invalid="!!error" :aria-describedby="error?'time-setting-error':undefined" @input="error=''" /></label></div>
      <p class="dialog-context">支持24:00，观测日期保持不变。</p>
      <p v-if="error" id="time-setting-error" class="dialog-error" role="alert">{{error}}</p>
      <div class="dialog-actions"><button type="button" @click="close">取消</button><button type="submit" class="primary-action">定位</button></div>
    </form>
  </dialog>
</template>
