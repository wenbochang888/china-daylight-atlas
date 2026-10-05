import { createApp } from 'vue';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@vuepic/vue-datepicker/dist/main.css';
import './styles.css';
import App from './App.vue';
import { initializePlatform, nativeIos } from './platform/runtime';

function mount() { createApp(App).mount('#app'); }
if (nativeIos) void initializePlatform().then(mount);
else mount();
