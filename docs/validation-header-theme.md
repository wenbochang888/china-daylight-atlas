# 2026-10-05 GitHub 入口与明暗主题验证

本轮加入页面右上角的 GitHub 仓库入口和亮色／暗色开关。默认亮色，通过浏览器存储记住选择；存储受限时仍可在当前页面切换。日历、详情、提示和时间轴使用共享主题颜色，地图保持既有昼夜配色。

此处记录初版独立工具行；用户随后批准将工具并入标题区，最新实现和验证见 [顶部工具重新设计](validation-header-tools.md)。

## 实际验证

- `npm run build`：类型检查与生产构建通过。Vite 仍提示部分构建块较大，本轮未调整分包。
- `npm run test:e2e -- tests/e2e/controls.spec.ts --grep '日期文字|时间轴点击'`：桌面 Chromium、手机 Chromium 和 WebKit 共 6 项通过，覆盖日历入口、关闭焦点及时间轴点击／拖动／键盘操作。
- 将本次 `dist/` 挂载到 `/atlas/`，分别检查 1440×1000 桌面 Chromium、360×800 手机 Chromium 和 390×844 手机 WebKit，三种场景全部通过。具体结果见 [checks.json](validation-images/header-theme/checks.json)。
- GitHub 入口的目标地址、新标签页打开及 `window.opener === null` 通过；检查时拦截目标页面请求，仅验证导航行为，未将 GitHub 远端页面可用性作为通过条件。
- 开关的键盘操作、焦点、状态文字、亮暗背景、刷新恢复主题及存储读写抛错时的切换通过。切换主题时日期、共享分钟与暂停状态保持，地图 canvas 实例及尺寸保持。
- 暗色日历跟随页面主题，完整位于横向视口范围内，Escape 关闭并恢复日期入口焦点。单图／双图切换后共享时刻和主题保持，没有横向溢出、页面异常或资源请求错误。
- 人工查看桌面暗色、360px 手机暗色及 WebKit 暗色日历截图，新增入口、文字、选中状态与焦点轮廓可读。

## 截图

- 桌面：[亮色](validation-images/header-theme/desktop-chromium-light.png)、[暗色](validation-images/header-theme/desktop-chromium-dark.png)。
- 360px 手机 Chromium：[亮色](validation-images/header-theme/mobile-chromium-light.png)、[暗色](validation-images/header-theme/mobile-chromium-dark.png)。
- 手机 WebKit：[暗色日历](validation-images/header-theme/mobile-webkit-dark-calendar.png)。

## 范围

工作区同时包含另一轮地图布局与全屏修改，本轮检查使用当时合并后的代码；本记录仅描述 GitHub 入口、主题与相关交互检查。未运行全量回归、地图数据校验或真机测试；未提交、推送或部署线上站点。
