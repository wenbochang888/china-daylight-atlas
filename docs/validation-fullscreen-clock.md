# 全屏日期时间位置调整验证

日期：2026-10-05。本记录为本次位置调整的验证，前轮全屏与手机布局记录继续保留。

## 实际修改

- 全屏日期时间不再固定在左上角，沿用普通地图的定位规则。宽图位于106°E、49.5°N附近的上方空白处；窄图放在顶部留白区，保持该经度对应的水平位置。
- 恢复日期、北京时间、时刻三行显示及普通地图对应的字号。宽全屏地图取消原先额外预留的顶部卡片高度，窄图继续预留顶部空间。
- 单图、双图使用同一定位逻辑，保留全屏安全区。未改动日期、分钟、播放或音频状态管理。
- README及AGENTS.md同步当前卡片规则。

## 实际验证

- `npm run build`：类型检查和生产构建通过，仍有既有地图资源包体积提示。
- `npm run test:e2e -- tests/e2e/fullscreen-clock.spec.ts --output=/private/tmp/china-daylight-fullscreen-clock`：桌面Chromium、手机Chromium及手机WebKit共6项通过。
- 浏览器检查普通／全屏位置、三行排布、按钮不遮挡、34个省级标签、单图画布保持、退出零点时刻，以及双图390×844和844×390旋转后各图卡片位置。
- 人工复查桌面全屏单图、手机WebKit全屏单图及横屏双图截图，卡片位于地图上方、显示完整。
- `git diff --check`：通过。

截图见：

- [桌面全屏单图](validation-images/fullscreen-clock/desktop-chromium-single.png)
- [手机全屏单图](validation-images/fullscreen-clock/mobile-webkit-single.png)
- [手机双图竖屏](validation-images/fullscreen-clock/mobile-webkit-compare-390.png)
- [手机双图横屏](validation-images/fullscreen-clock/mobile-webkit-compare-844.png)

手机结果来自浏览器模拟，未做真实手机或物理刘海安全区检查。本次未重跑前轮全量回归、生产子目录检查，未部署。
