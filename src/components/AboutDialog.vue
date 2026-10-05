<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import UiIcon from './UiIcon.vue';
import app from '../../ios-app.json';
const dialog = ref<HTMLDialogElement>();
const licenseText = ref('');
let licenseRequest: AbortController | undefined;
async function loadLicenses(event: Event) {
  if (!(event.target as HTMLDetailsElement).open || licenseText.value || licenseRequest) return;
  licenseRequest = new AbortController();
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}licenses.txt`, { signal: licenseRequest.signal });
    if (!response.ok) throw new Error('missing notices');
    licenseText.value = await response.text();
  } catch (error) { if (!licenseRequest.signal.aborted) licenseText.value = '许可文件暂时无法读取，请重新打开应用后重试。'; }
}
let trigger: HTMLElement | null = null;
function open(event: Event) {
  trigger = event.currentTarget as HTMLElement;
  if (!dialog.value?.open) dialog.value?.showModal();
}
function close() { dialog.value?.close(); }
function restoreFocus() { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); }
onBeforeUnmount(() => { licenseRequest?.abort(); close(); });
defineExpose({ open });
</script>
<template>
  <dialog ref="dialog" class="mobile-dialog about-dialog" aria-labelledby="about-title" @close="restoreFocus">
    <div class="dialog-heading"><span id="about-title">关于中国昼夜地图</span><button class="icon-button" autofocus aria-label="关闭关于" @click="close"><UiIcon name="close" /></button></div>
    <p class="about-version">版本 {{app.version}} · 构建 {{app.buildNumber}} · iPhone 测试版</p>
    <section><h3>离线观测</h3><p>地图、节气和太阳计算在设备内运行，音乐随应用提供。全部时刻使用北京时间。每次冷启动从今天 00:00 开始，保持暂停。</p></section>
    <section><h3>数据与模型</h3><p>行政区数据来自天地图公开页面，取得日为 2026-10-02，来源标示 2025 年 9 月局部更新。属于固定快照，不代表实时行政区变化。</p><p>日出、日落与昼长只代表详情中的代表点。模型不包含天气、地形、建筑遮挡和实际海拔。</p></section>
    <section><h3>隐私说明</h3><p>本测试版没有账户、广告、定位、分析或数据上传功能。主题与音乐选择仅保存在本机，卸载应用后清除。主动打开 GitHub 时，由系统浏览器访问外部网站，适用该网站的隐私规则。</p><p>通过 TestFlight 安装时，Apple 可按其测试服务规则处理崩溃、使用情况及你主动提交的反馈。</p></section>
    <section><h3>资源许可</h3><p>自有代码与文档采用 MIT，署名 wenbochang888。地图、钢琴音频及依赖适用各自授权，地图和音频已由维护者确认允许使用与公开分发，不改授 MIT。</p></section>
    <details class="about-licenses" @toggle="loadLicenses"><summary>查看开源许可与第三方声明</summary><pre>{{licenseText || '正在读取本地许可文件…'}}</pre></details>
    <p class="about-feedback">测试反馈请通过 TestFlight 提交，附上设备型号、观测日期、北京时间和复现步骤。</p>
  </dialog>
</template>
