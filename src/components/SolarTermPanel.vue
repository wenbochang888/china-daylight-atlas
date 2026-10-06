<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import type { SolarTermOption } from '../domain/types';
const DateControls = defineAsyncComponent(() => import('./DateControls.vue'));
const props = defineProps<{ dates: string[]; min: string; max: string; today: string; year: number; compare: boolean; target: number; terms: SolarTermOption[]; disabled: boolean; error: string; selected?: boolean; popupHost?: HTMLElement }>();
const emit = defineEmits<{ date: [index: number, value: string]; compare: []; target: [index: number]; term: [value: SolarTermOption]; retry: [] }>();
const important: Record<string,string> = { 春分:'昼夜近等长', 夏至:'长昼节点', 秋分:'昼夜近等长', 冬至:'短昼节点' };
const seasons = [
  { id: 'spring', name: '春', note: '春生', names: ['立春','雨水','惊蛰','春分','清明','谷雨'] },
  { id: 'summer', name: '夏', note: '夏长', names: ['立夏','小满','芒种','夏至','小暑','大暑'] },
  { id: 'autumn', name: '秋', note: '秋收', names: ['立秋','处暑','白露','秋分','寒露','霜降'] },
  { id: 'winter', name: '冬', note: '冬藏', names: ['立冬','小雪','大雪','冬至','小寒','大寒'] },
];
const groups = computed(() => seasons.map(season => ({ ...season, terms: season.names.map(name => props.terms.find(term => term.name === name)).filter((term): term is SolarTermOption => !!term) })));
</script>
<template>
  <section class="date-panel" aria-label="日期与节气选择">
    <div class="date-sticky">
      <DateControls :dates="dates" :min="min" :max="max" :today="today" :compare="compare" :disabled="disabled" :popup-host="popupHost" @date="(index,value)=>emit('date',index,value)" @compare="emit('compare')" />
      <p class="date-range"><span>观测范围 · 两整年</span><time>{{min}} — {{max}}</time></p>
      <p v-if="compare&&!selected" class="compare-hint">点击一个省份，比较代表点的日出、日落与昼长。</p>
    </div>
    <div class="observation-scroll">
      <slot />
      <section class="solar-calendar" aria-label="四季观测历">
        <div class="calendar-heading"><h3>二十四节气 · {{year}}年</h3><span>选中即播放</span></div>
        <p class="terms-description">从节气当天零点，观察一日的昼夜更替。</p>
        <div v-if="compare" class="term-target" aria-label="节气应用日期"><button v-for="i in [0,1]" :key="i" :aria-label="`节气应用于日期 ${i+1}`" :aria-pressed="target===i" @click="emit('target',i)">日期 {{i+1}}</button></div>
        <div v-if="error" class="panel-error" role="alert">{{error}}<button @click="emit('retry')">重试</button></div>
        <section v-for="season in groups" :key="season.id" class="season" :data-season="season.id" :aria-label="`${season.name}季节气`">
          <div class="season-heading"><b aria-hidden="true"></b><h4>{{season.name}}</h4><span>{{season.note}}</span><i class="season-rule" aria-hidden="true"></i></div>
          <div class="terms-grid">
            <button v-for="term in season.terms" :key="term.name" class="term-button" :class="{important:!!important[term.name],active:!!term.date&&term.date===dates[target]}" :disabled="disabled||term.disabled" :aria-label="`${term.name} ${term.date??'超出日期范围'}${important[term.name] ? ` ${important[term.name]}` : ''}`" :aria-pressed="!!term.date&&term.date===dates[target]" @click="emit('term',term)">
              <strong>{{term.name}}</strong><small>{{term.date??'超出日期范围'}}</small><span v-if="important[term.name]" class="term-note">{{important[term.name]}}</span>
            </button>
          </div>
        </section>
      </section>
    </div>
  </section>
</template>
