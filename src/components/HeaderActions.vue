<script setup lang="ts">
import UiIcon from './UiIcon.vue';
import { nativeIos, openExternalUrl } from '../platform/runtime';
defineProps<{ dark: boolean }>();
const emit = defineEmits<{ theme: []; about: [event: Event] }>();
function openGithub(event: MouseEvent) {
  if (!nativeIos) return;
  event.preventDefault();
  void openExternalUrl('https://github.com/wenbochang888/china-daylight-atlas').catch(() => {
    window.alert('暂时无法打开 GitHub，请稍后重试。');
  });
}
</script>
<template>
  <nav class="page-actions" aria-label="页面工具">
    <a class="github-link" href="https://github.com/wenbochang888/china-daylight-atlas" target="_blank" rel="noopener noreferrer" :aria-label="nativeIos?'GitHub 开源代码（系统浏览器打开）':'GitHub 开源代码（新标签页打开）'" title="查看 GitHub 开源代码" @click="openGithub"><UiIcon name="github" /><span v-if="!nativeIos">GitHub</span></a>
    <button v-if="nativeIos" class="theme-button" aria-label="关于中国昼夜地图" title="关于中国昼夜地图" @click="emit('about',$event)"><UiIcon name="info" /></button>
    <button class="theme-button" type="button" role="switch" aria-label="暗色模式" :aria-checked="dark" :title="dark?'切换为亮色':'切换为暗色'" @click="emit('theme')"><UiIcon :name="dark?'sun':'moon'" /></button>
  </nav>
</template>
