# 手机全屏对比、节气样式与简称验证

日期：2026-10-05。包含用户本轮追加的“全屏简称跑偏”和“时间卡片不能挡地图”修复。

## 实际修改

- iOS 携带的旧网页包仍有独立黄色描边节气标签，最新源码已为日期同行括号。本轮重新构建、同步并安装，统一为 `2026.06.21（夏至）` 三行卡片。
- 手机竖屏全屏保留日期1在上、日期2在下，两组内容向中线靠拢，完整内容边界以12px间距为目标。两图共享地理中心和缩放，每图独立显示padding；普通与横屏对比维持原布局。
- 各半屏分别计算安全区与可用高度，选可同时容纳两图的共同缩放，避免把两半屏的外侧安全区叠加。右上播放／退出按钮在竖屏双图时上下排列，释放时间卡片所在的一行。
- 取消原50px向下偏移。卡片完整置于全国最北端上方，手机／窄图12px、宽图16px，不压住中国轮廓。日期／节气切换不改变卡片预留宽度。
- 单字简称在狭长省份中优先保留省内中心，允许文字边缘跨界；小于单字面积的区域和微小特殊地区继续外置并使用引线。地图与卡片偏移完成后重新排布标注，播放帧不重算。
- iOS 资源清单增加SHA-256；`ios:sync`自动核对网站、App包和原生工程中的资源。签名产物中的网页资源也逐项核对。

## 本轮实际验证

| 检查 | 结果 |
| --- | --- |
| `npm run ios:sync` | 最新最终构建通过，包含Vue／TypeScript检查；原有大资源体积提醒仍存在 |
| 相关单元测试 | 4文件、13项通过：靠拢边界、节气日期、标注几何与狭长省份简称 |
| 三浏览器定向E2E | 15个场景通过，覆盖360／390／430px、模拟安全区、横竖屏、退出恢复、34省名、粤的省内中心、所有标注中心归属、普通布局与节气 |
| App生产包WebKit | 通过；实际渲染像素核对两图轮廓比例、靠拢距离及卡片与轮廓间隔，DOM检查同行节气样式 |
| 网站生产 `/atlas/` WebKit | 通过；同样覆盖真实MP3、双图唯一音频、24:00、纽约设备时区、旋转、退出保留画布，无外部资源或maps JSON请求 |
| 三份网页资源 | 网站、`dist-ios`、原生工程的15个文件SHA-256一致 |
| 真机签名构建 | Debug / iphoneos `BUILD SUCCEEDED`；签名产物中15个网页资源与本轮清单一致 |
| 本人iPhone安装 | iPhone 16、iOS 26.3，最终修复版通过devicectl安装；版本仍为0.1.0 (1) |

最终E2E首轮14项通过，桌面Chromium的一项在读取正在更新的MapLibre符号索引时异常。测试改为等待地图就绪并轮询索引，再单独重跑该场景通过；没有修改MapLibre或忽略最终断言。

早期生产检查脚本误以为节气选择后手机面板仍打开，并使用仅开发模式存在的Vue内部属性；修正为遵循面板自动关闭、读取实际WebGL像素后通过。模拟安全区图片不是实体iPhone截图。

## 证据与复现

结果位于 [comparison-alignment](validation-images/comparison-alignment/)：`package-webkit.json`、`website-subdirectory.json`；最终生产截图为`package-portrait.png`、`package-simulated-safe-area.png`、`website-portrait.png`、`website-simulated-safe-area.png`。三浏览器360／390／430px截图同目录。各截图均为浏览器检查产物。

```sh
npm run ios:sync
node scripts/check-ios-resources.mjs
npm run test:unit -- tests/unit/comparison-layout.test.ts tests/unit/solar-term-date.test.ts tests/unit/label-layout.test.ts tests/unit/label-geometry.test.ts
npm run test:e2e -- tests/e2e/comparison-alignment.spec.ts tests/e2e/fullscreen-clock.spec.ts tests/e2e/map-labels-terms.spec.ts --output=/tmp/daylight-comparison-final
node scripts/check-ios-web.mjs --comparison-alignment
node scripts/check-ios-web.mjs --website --comparison-alignment
```

原生编译、安装及启动日志保存在本机`/tmp/daylight-comparison-*.log`，不作为长期仓库资源。

## 尚未验证

最后一次启动最终安装包被手机锁屏阻止。此前中间版本曾启动成功，不能作为最终版本启动或视觉验收的证明。最终版本需要解锁手机后打开，实际检查夏至／冬至竖屏全屏、粤等简称、时间卡片与横竖屏切换。本轮未完成实体手机完整视觉验收、首次离线启动或TestFlight发布，也没有部署网站。
