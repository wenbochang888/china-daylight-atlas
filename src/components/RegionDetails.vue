<script setup lang="ts">
import UiIcon from './UiIcon.vue';
import { computed } from 'vue';
import { formatMinute } from '../domain/beijing-time';
import { lightLabels, lightState, solarAltitude, solarEvents } from '../domain/solar';
import type { Region, SunVector } from '../domain/types';
import { browseLevel, regionPath } from '../data/map-repository';
const props = defineProps<{ region: Region | null; index: Map<string, Region>; dates: string[]; vectors: SunVector[] }>();
const emit = defineEmits<{ select: [id: string] }>();
const path=computed(()=>props.region?regionPath(props.region,props.index):[]);
const rows=computed(()=>props.region?props.dates.map(date=>({date,events:solarEvents(date,...props.region!.center)})):[]);
const states=computed(()=>props.region?props.vectors.map(vector=>lightState(solarAltitude(vector,...props.region!.center))):[]);
const eventTime=(minute:number|null)=>minute===null?'当日无该事件':formatMinute(minute);
const duration=(minutes:number)=>`${Math.floor(Math.round(minutes)/60)}小时 ${Math.round(minutes)%60}分`;
</script>
<template>
  <section v-if="region" class="region-details" aria-label="地区日光详情">
    <nav class="breadcrumbs" aria-label="行政区路径"><button @click="emit('select','')">全国</button><template v-for="item in path" :key="item.id"><span>/</span><button @click="emit('select',item.id)">{{item.name}}</button></template></nav>
    <div class="region-title"><h2>{{region.name}}</h2><span>{{browseLevel(region)}}</span></div>
    <p class="point-description">{{region.pointKind}}<br><span>{{region.center[0].toFixed(3)}}°E · {{region.center[1].toFixed(3)}}°N</span></p>
    <div v-for="(row,i) in rows" :key="i" class="day-details">
      <div class="details-date"><span>{{row.date}}</span><span class="light-state" :class="states[i]"><i></i>{{lightLabels[states[i]]}}</span></div>
      <dl class="event-grid"><div><dt><UiIcon name="sunrise" />日出</dt><dd :class="{'no-event':row.events.sunrise===null}">{{eventTime(row.events.sunrise)}}</dd></div><div><dt><UiIcon name="sunset" />日落</dt><dd :class="{'no-event':row.events.sunset===null}">{{eventTime(row.events.sunset)}}</dd></div></dl>
      <div class="daylight-total"><span>昼长</span><strong>{{duration(row.events.daylightMinutes)}}</strong></div><div class="daylight-bar" aria-hidden="true"><span :style="{width:`${row.events.daylightMinutes/1440*100}%`}"></span></div>
    </div>
    <p class="detail-note">详情仅代表上述位置。同一地区内可以同时出现白天和黑夜。</p>
  </section>
  <section v-else class="explore-intro">
    <h2>看见一日<br>昼夜更替。</h2>
    <p>点击地图中的省份，查看代表点的日出、日落与昼长。</p>
    <div class="intro-rule"></div>
    <p>选择一个节气，从当天零点开始观察。</p>
    <p class="intro-secondary">昼夜交替时缓慢播放，完整白天或黑夜时自动加快。</p>
  </section>
</template>
