<script setup lang="ts">
import { formatMinute } from '../domain/beijing-time';
import UiIcon from './UiIcon.vue';
defineProps<{ minute: number; playing: boolean; ready: boolean; musicEnabled: boolean }>();
const emit = defineEmits<{ toggle: []; music: []; edit: [event: Event] }>();
</script>
<template>
  <div class="clock-control" aria-label="北京时间与播放">
    <div class="clock-face">
      <button class="clock-edit" aria-label="设置北京时间" :disabled="!ready" title="设置北京时间" @click="emit('edit',$event)"><strong data-testid="clock">{{formatMinute(minute)}}</strong></button>
      <div class="clock-caption"><span>北京时间</span><small>UTC+8</small></div>
      <div class="day-progress" aria-hidden="true"><span :style="{transform:`scaleX(${minute/1440})`}"></span></div>
    </div>
    <div class="clock-actions">
      <button class="play-button" :disabled="!ready" :aria-label="playing?'暂停播放':'开始播放'" :aria-pressed="playing" @click="emit('toggle')">
        <UiIcon :name="playing?'pause':'play'" /><span class="play-label">{{playing?'暂停':'播放'}}</span>
      </button>
      <button class="music-button" :aria-label="musicEnabled?'关闭音乐':'开启音乐'" :aria-pressed="musicEnabled" :title="musicEnabled?'关闭音乐':'开启音乐'" @click="emit('music')">
        <UiIcon :name="musicEnabled?'volume':'mute'" /><span class="music-label">{{musicEnabled?'音乐开':'音乐关'}}</span>
      </button>
    </div>
  </div>
</template>
