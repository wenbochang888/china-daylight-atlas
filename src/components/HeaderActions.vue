<script setup lang="ts">
import UiIcon from './UiIcon.vue';
defineProps<{ dark: boolean }>();
const emit = defineEmits<{ theme: [] }>();
</script>
<template>
  <nav class="page-actions" aria-label="页面工具">
    <a class="github-link" href="https://github.com/wenbochang888/china-daylight-atlas" target="_blank" rel="noopener noreferrer" aria-label="GitHub 开源代码（新标签页打开）" title="查看 GitHub 开源代码"><UiIcon name="github" />GitHub</a>
    <button class="theme-button" type="button" role="switch" aria-label="暗色模式" :aria-checked="dark" :title="dark?'切换为亮色':'切换为暗色'" @click="emit('theme')"><UiIcon :name="dark?'sun':'moon'" /></button>
  </nav>
</template>
