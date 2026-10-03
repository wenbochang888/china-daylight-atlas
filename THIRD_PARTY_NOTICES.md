# 第三方资源与许可范围

本项目的自有源码、脚本与文档采用 [MIT 许可证](LICENSE)，版权署名为 `wenbochang888`。第三方地图数据、音频和依赖继续适用各自的授权条件，不因存放在本仓库中而改授 MIT 许可。

## 地图与海岛注记

- 原始行政区快照：`data/source/official/`，来源为[天地图官方公开行政区网页](https://cloudcenter.tianditu.gov.cn/administrativeDivision)。
- 派生地图资源：`public/maps/`，从原始快照及海岛注记生成；派生操作不改变第三方数据的许可归属。
- 海岛注记：`data/source/island-annotations.json`，各项资料来源与绘图位置依据见[数据来源记录](docs/data/provenance.md)。

2026-10-03，项目维护者确认已获得允许公开分发本项目地图数据的授权。源公开响应未附单独开源许可证，本仓库不为这些数据另行授予开源许可。需要独立复用或再分发地图及相关资料时，应核实原权利方授权的适用范围；本项目的 MIT 代码许可证不代替该授权。

取得日期、源更新说明、数据覆盖、坐标基准与原始哈希口径见[数据来源记录](docs/data/provenance.md)及[覆盖表](docs/data/coverage.md)。

## 钢琴音频

本项目使用 `src/mp3/钢琴曲.mp3`。2026-10-03，项目维护者确认已取得使用及公开分发授权，且无强制署名要求。音频不适用本项目的 MIT 代码许可证；独立复用或再分发时应核实原音频授权范围。

未选用的候选音乐不进入版本控制与构建产物。

## 运行时直接依赖

以下版本与许可证已按当前锁定依赖核对。完整依赖树以 `package-lock.json` 为准，直接与间接依赖各自的版权声明及许可证应予保留。

| 依赖 | 锁定版本 | 许可证 | 上游项目 |
| --- | --- | --- | --- |
| Vue | 3.5.43 | MIT | [vuejs/core](https://github.com/vuejs/core) |
| Vue Datepicker | 14.0.0 | MIT | [Vuepic/vue-datepicker](https://github.com/Vuepic/vue-datepicker) |
| date-fns | 4.4.0 | MIT | [date-fns/date-fns](https://github.com/date-fns/date-fns) |
| MapLibre GL JS | 5.24.0 | BSD-3-Clause | [maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js) |
| Astronomy Engine | 2.1.19 | MIT | [cosinekitty/astronomy](https://github.com/cosinekitty/astronomy) |
