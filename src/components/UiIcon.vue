<script setup lang="ts">
defineProps<{ name: 'sun' | 'play' | 'pause' | 'close' | 'compare' | 'home' | 'plus' | 'minus' | 'extent' | 'arrow' | 'pin' | 'calendar' | 'sunrise' | 'sunset' }>();
const paths = {
  sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4',
  play: 'm9 5 10 7-10 7Z', pause: 'M9 5v14m6-14v14', close: 'm6 6 12 12M18 6 6 18',
  compare: 'M3 5h18v14H3ZM12 5v14', home: 'm3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7',
  plus: 'M5 12h14M12 5v14', minus: 'M5 12h14', extent: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
  arrow: 'M4 12h15m-6-6 6 6-6 6', pin: 'M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z',
  calendar: 'M5 5h14v16H5ZM8 3v4m8-4v4M5 10h14',
  sunrise: 'M3 19h18M5 15h14M8 15a4 4 0 0 1 8 0M12 3v6m-3-3 3-3 3 3M3 11l2 1m14 0 2-1',
  sunset: 'M3 19h18M5 15h14M8 15a4 4 0 0 1 8 0M12 3v6m-3-3 3 3 3-3M3 11l2 1m14 0 2-1',
};
</script>
<template>
  <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <circle v-if="name==='sun'" cx="12" cy="12" r="4" />
    <circle v-if="name==='pin'" cx="12" cy="9" r="2" />
    <path :d="paths[name]" :fill="name==='play'?'currentColor':'none'" />
  </svg>
</template>
