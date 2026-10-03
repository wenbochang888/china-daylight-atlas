<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { VueDatePicker } from '@vuepic/vue-datepicker';
import { zhCN } from 'date-fns/locale';
import UiIcon from './UiIcon.vue';
import { clampDate } from '../domain/beijing-time';
const props = defineProps<{ dates: string[]; min: string; max: string; today: string; compare: boolean; disabled?: boolean; popupHost?: HTMLElement }>();
const emit = defineEmits<{ date: [index: number, value: string]; compare: [] }>();
const pickers = ref<InstanceType<typeof VueDatePicker>[]>([]), triggers = ref<HTMLButtonElement[]>([]);
const openIndex = ref<number | null>(null);
const dateId = useId();
// Calendar dates are local civil dates, never UTC instants. Application values remain strings.
function calendarDate(value: string) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, 12); }
const bounds = computed(() => ({ min: calendarDate(props.min), max: calendarDate(props.max) }));
const labels = {
  menu: '选择观测日期', openYearsOverlay: '选择年份', openMonthsOverlay: '选择月份',
  nextMonth: '下个月', prevMonth: '上个月', nextYear: '下一年', prevYear: '上一年',
  day: ({ value }: { value: Date }) => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`,
};
function change(index: number, value: unknown) {
  if (typeof value === 'string') emit('date', index, clampDate(value, { min: props.min, max: props.max }));
}
function opened(index: number) {
  if (openIndex.value !== null && openIndex.value !== index) pickers.value[openIndex.value]?.closeMenu();
  openIndex.value = index;
}
async function closed(index: number) {
  if (openIndex.value !== index) return;
  openIndex.value = null; await nextTick(); triggers.value[index]?.focus();
}
function calendarKeydown(event: KeyboardEvent) {
  if (openIndex.value === null) return;
  if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element
    && event.target.closest('[role="gridcell"][tabindex]')?.closest('[role="dialog"]')?.getAttribute('aria-label') === labels.menu) {
    // Selection restores button focus; suppress the native click from this same key.
    event.preventDefault(); return;
  }
  if (event.key !== 'Escape') return;
  // Consume the first Escape before the enclosing native dialog can cancel.
  event.preventDefault(); event.stopImmediatePropagation(); pickers.value[openIndex.value]?.closeMenu();
}
onMounted(() => document.addEventListener('keydown', calendarKeydown, true));
onBeforeUnmount(() => document.removeEventListener('keydown', calendarKeydown, true));
</script>
<template>
  <div class="date-controls">
    <VueDatePicker v-for="(date, i) in dates" :key="i" ref="pickers" :model-value="date" model-type="yyyy-MM-dd"
      :locale="zhCN" :min-date="bounds.min" :max-date="bounds.max" :year-range="[bounds.min.getFullYear(),bounds.max.getFullYear()]"
      prevent-min-max-navigation :time-config="{enableTimePicker:false}" :input-attrs="{clearable:false}" :disabled="disabled" auto-apply arrow-navigation
      no-today :highlight="{dates:[calendarDate(today)]}" :aria-labels="labels" :teleport="popupHost ?? true"
      :floating="{strategy:'fixed',placement:'bottom-end',arrow:false,shift:{crossAxis:true,padding:8},flip:{padding:8}}" :transitions="false"
      :config="{allowPreventDefault:true,monthChangeOnScroll:false}" @update:model-value="change(i,$event)" @open="opened(i)" @closed="closed(i)">
      <template #dp-input="{toggleMenu,isMenuOpen}">
        <button ref="triggers" type="button" class="date-field" :aria-label="`日期 ${i+1}`" :aria-describedby="`${dateId}-${i}`" aria-haspopup="dialog" :aria-expanded="isMenuOpen"
          :data-date="date" :data-min="min" :data-max="max" :disabled="disabled" @click.stop="toggleMenu"
          @keydown.enter.stop.prevent="toggleMenu" @keydown.space.stop.prevent="toggleMenu">
          <span>{{compare ? `日期 ${i+1}` : '观测日期'}}</span><time :id="`${dateId}-${i}`">{{date}}</time><UiIcon name="calendar" />
        </button>
      </template>
    </VueDatePicker>
    <button class="compare-button" :class="{ active: compare }" :disabled="disabled" :aria-pressed="compare" @click="emit('compare')"><UiIcon name="compare" />{{ compare ? '退出对比' : '两天对比' }}</button>
  </div>
</template>
