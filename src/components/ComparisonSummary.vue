<script setup lang="ts">
import type { DayComparisonSummary } from '../domain/types';
defineProps<{ summary: DayComparisonSummary }>();
</script>
<template>
  <section class="comparison-summary" aria-label="代表点两日对比摘要">
    <h3>两日对比 · 日期2相较日期1</h3>
    <p class="comparison-dates">日期1 {{summary.dates[0]}}<br>日期2 {{summary.dates[1]}}</p>
    <dl><div><dt>昼长</dt><dd>{{summary.daylight}}</dd></div><div><dt>日出</dt><dd>{{summary.sunrise}}</dd></div><div><dt>日落</dt><dd>{{summary.sunset}}</dd></div></dl>
    <p class="comparison-note">仅比较同一代表点，按分钟显示。</p>
  </section>
</template>
