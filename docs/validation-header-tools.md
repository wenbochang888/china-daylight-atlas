# 2026-10-05 顶部工具重新设计验证

用户批准将 GitHub 和明暗切换并入已有顶部标题区域。本轮移除独立工具行，电脑端放在“观测记录”旁，1099px及以下放在地图标题右侧，时间、播放和音乐排列在下一行。GitHub 使用透明背景的小图标与文字；主题按钮只保留表示目标模式的太阳／月亮图标，点击区域44px。

## 实际验证

- `npm run build`：类型检查与生产构建通过；Vite 的大构建块提示仍存在，本轮未调整分包。
- `npm run test:e2e -- tests/e2e/controls.spec.ts --grep '日期文字|时间轴点击'`：桌面 Chromium、手机 Chromium 和 WebKit 共6项通过，覆盖中文日历入口、关闭焦点、时间轴点击／拖动／键盘操作。
- 将本次生产构建挂载到 `/atlas/`，检查以下6种场景，全部通过：1440×1000、1100×900、768×1024、601×900、360×800 Chromium，以及390×844 WebKit。具体尺寸及布局坐标见 [checks.json](validation-images/header-tools/checks.json)。
- 工具组位于相应标题容器内，页面只有一份入口，与标题及时间区无重叠，页面无水平溢出。两个入口的点击区域高度均44px，主题按钮宽度44px；360px手机保留播放及音乐文字。
- 明暗按钮的目标图标、悬停提示、可访问状态、Space键操作及焦点通过。主题切换保留日期、共享时刻和暂停状态，主地图canvas实例及尺寸保持。
- 单图、双图、主题刷新记忆、存储不可用时切换、暗色日历与Escape关闭焦点通过。桌面场景另检查1099px、600px和1100px之间的位置切换，主题和双图时刻保持。
- GitHub的新标签页目标地址和`window.opener === null`通过；检查拦截目标请求，只验证导航行为，不依赖远端页面可用性。
- 六种场景的全屏备用模式均隐藏顶部工具，退出后恢复入口及主题。未记录页面异常或资源加载错误。
- 人工查看桌面亮色、1100px暗色、768px亮色、360px亮色和手机WebKit暗色截图，标题、时间及工具组排版清晰。

## 截图

- 桌面：[亮色](validation-images/header-tools/desktop-chromium-light.png)、[暗色](validation-images/header-tools/desktop-chromium-dark.png)。
- 平板：[768px亮色](validation-images/header-tools/tablet-chromium-light.png)。
- 手机：[360px亮色](validation-images/header-tools/mobile-chromium-light.png)、[WebKit暗色](validation-images/header-tools/mobile-webkit-dark.png)。
- 双图：[桌面暗色](validation-images/header-tools/desktop-chromium-dark-compare.png)、[手机暗色](validation-images/header-tools/mobile-chromium-dark-compare.png)。

## 范围

本轮只修改顶部工具组件、位置、样式和对应高度计算，保留工作区已有的其他地图与全屏改动。未运行全量回归、数据校验或真机检查，未提交、推送或发布线上站点。初版工具行及主题验证保留在 [历史记录](validation-header-theme.md)。
