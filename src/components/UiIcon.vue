<script setup lang="ts">
defineProps<{ name: 'sun' | 'moon' | 'github' | 'play' | 'pause' | 'volume' | 'mute' | 'close' | 'compare' | 'home' | 'plus' | 'minus' | 'extent' | 'arrow' | 'pin' | 'calendar' | 'sunrise' | 'sunset' }>();
const paths = {
  sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4',
  moon: 'M20.9 13.2A9 9 0 0 1 10.8 3.1a9 9 0 1 0 10.1 10.1Z',
  github: 'M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.82.09-.64.35-1.08.64-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.58 9.58 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z',
  play: 'm9 5 10 7-10 7Z', pause: 'M9 5v14m6-14v14', close: 'm6 6 12 12M18 6 6 18',
  volume: 'M11 4 6 8H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
  mute: 'M11 4 6 8H3v8h3l5 4ZM16 9l6 6m0-6-6 6',
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
    <path :d="paths[name]" :fill="name==='play'||name==='github'?'currentColor':'none'" :stroke="name==='github'?'none':undefined" />
  </svg>
</template>
