<script setup lang="ts">
import { formatMinute } from '../domain/beijing-time';
import UiIcon from './UiIcon.vue';
defineProps<{ minute: number; playing: boolean; ready: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
</script>
<template>
  <div class="clock-control" aria-label="北京时间与播放">
    <div class="clock-face">
      <strong data-testid="clock">{{formatMinute(minute)}}</strong>
      <div class="clock-caption"><span>北京时间</span><small>UTC+8</small></div>
      <div class="day-progress" aria-hidden="true"><span :style="{transform:`scaleX(${minute/1440})`}"></span></div>
    </div>
    <button class="play-button" :disabled="!ready" :aria-label="playing?'暂停播放':'开始播放'" :aria-pressed="playing" @click="emit('toggle')">
      <UiIcon :name="playing?'pause':'play'" /><span class="play-label">{{playing?'暂停':'播放'}}</span>
    </button>
  </div>
</template>
