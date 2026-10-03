<script setup lang="ts">
import { formatMinute } from '../domain/beijing-time';
defineProps<{ minute: number; ready: boolean }>();
const emit = defineEmits<{ scrubstart: []; seek: [minute: number] }>();
function seek(event: Event) { emit('seek', Number((event.target as HTMLInputElement).value)); }
function keyboard(event: KeyboardEvent) {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) emit('scrubstart');
}
</script>
<template>
  <div class="time-scrubber">
    <label for="observation-minute">拖动查看时刻</label>
    <input id="observation-minute" type="range" min="0" max="1440" step="1" :value="minute" :disabled="!ready"
      aria-label="北京时间时间轴" :aria-valuetext="formatMinute(minute)" :style="{'--time-progress':`${minute/1440*100}%`}"
      @pointerdown="emit('scrubstart')" @keydown="keyboard" @input="seek" @change="seek" />
    <div class="time-ticks" aria-hidden="true"><span v-for="value in [0,360,720,1080,1440]" :key="value">{{formatMinute(value)}}</span></div>
  </div>
</template>
