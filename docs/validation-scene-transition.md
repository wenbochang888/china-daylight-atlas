# PC／H5尺寸切换与精选场景过渡 · 2026-10-06

本轮只修复用户截图中的地图表达式报错及三个精选场景的闪影，不扩展产品功能。

## 修改与原因

- `resizeProvinceLabels` 在尺寸变化的中间布局没有可放置位置时，原来仍生成没有分支的 `match` 表达式，导致 `taiwan-label.layout.text-offset` 报“Expected at least 4 arguments”。空结果现在返回 `['literal',[0,0]]`，后续布局继续正常排布。
- 场景准备／结果提示改在探索栏固定空间内显示，取消临时提示条插入造成的高度反复变化。
- 精选场景的主图、附图与时间卡片整体140ms淡出，等待实际CSS动画结束才更新日期和时刻；地图相机、标注与新图资源完成绘制后180ms淡入。使用真实动画完成与地图idle信号，不以固定等待时间猜测准备完成。
- MapLibre符号淡入关闭，减少尺寸变化和标注重新排布的双影。新过渡只作用于精选场景，时间轴播放继续直接更新太阳向量。
- 过渡取消、重复点击、图形错误、卸载保留旧请求保护和资源清理；减少动态效果时不做淡入淡出。

## 本轮检查

- `npm run test:unit -- tests/unit/label-layout.test.ts tests/unit/observation.test.ts`：33项通过，包括尺寸中间状态无法放置任何文字的回归用例。
- 类型检查与生产构建通过。构建保留原全国几何资源超过1300kB的分块提示。
- 四项观测功能与本轮两项修复按桌面Chromium、360px手机Chromium定向抽查，共10项通过。反复跨越1440、360、599、600px尺寸，保持同一主图实例、34省名，无页面／控制台错误。
- 过渡检查记录日期与时间发生变化时地图的实际不透明度，确认更新发生在旧画面完全淡出后；检查新图完成、省名恢复、单图高度稳定、切换中再次点击以及减少动态效果。

补充“过渡途中再次点击”后，最终单独重跑本轮4项修复用例，全部通过；实际查看桌面和手机最终场景截图。

```sh
npm run test:unit -- tests/unit/label-layout.test.ts tests/unit/observation.test.ts
npm run build
npm run test:e2e -- tests/e2e/scene-transition.spec.ts tests/e2e/observation.spec.ts --project=desktop-chromium --project=mobile-chromium --output=/tmp/daylight-scene-transition
npm run test:e2e -- tests/e2e/scene-transition.spec.ts --project=desktop-chromium --project=mobile-chromium --output=/tmp/daylight-scene-transition-final
```

首轮发现空反馈区仍带status角色，以及固定160ms等待在低帧率下没有覆盖完整淡出。分别改为有内容时提供角色、等待CSS动画的实际完成，随后按最终结果复查。

截图仅本机保存至 `docs/validation-images/scene-transition/`，遵循仓库忽略规则，不新增截图Git资产。本轮未执行完整回归、性能测试、WebKit专项、真机或iOS打包验证，未提交推送或部署。
