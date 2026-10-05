# 全屏与手机地图显示验证

日期：2026-10-05。历史验证文件和截图继续保留。

## 实际修改

- 地图右上角新增全屏入口。优先使用浏览器原生全屏，接口缺失或拒绝时铺满浏览器可视区域；全屏保留日期时间、播放／暂停和退出按钮。
- 单图和双图复用原有主地图及唯一音频。双图全屏按视口方向排列，取消普通页面的最小高度；退出恢复普通布局、滚动与入口焦点，迟到请求不能重新打开全屏。
- 手机显示模式不创建南海附图，并取消主画布为附图预留的底部空间。附图重新出现时独立创建，主图、日期、分钟和音乐保留。
- 手机及小于600px的地图使用34个固定单字展示简称，三个标签图层统一12px；详情和源数据名称保持完整，原始几何及全国天文计算输入不变。
- 标注避让包括全屏控件、时间卡片及可见附图。全屏时间卡片提供可访问的日期时间，取景及控件保留安全区。
- README与AGENTS.md已同步当前规则。截图包含工作区同期加入的GitHub及明暗入口，全屏统一隐藏页面工具。

## 实际验证

| 检查 | 本次结果 |
| --- | --- |
| `npm run test:unit` | 8个文件、59项通过，新增简称对应及三图层文字／避让验证 |
| `npm run build` | 类型检查与生产构建通过；仍有内置地图包的体积提示 |
| 全屏专项 | 桌面Chromium、手机Chromium、手机WebKit：20项通过、4项按项目跳过 |
| 日期／选区／音乐／首屏回归 | 81个不同项目场景最终通过，6项按项目跳过 |
| 最终针对性复验 | 24项中20项通过、4项跳过，覆盖最终全屏布局和三个项目的双图画布截图回归 |
| `/atlas/` 生产子目录 | 7种尺寸通过，JSON结果为零失败、零站外资源请求 |
| `git diff --check` | 通过 |

全屏专项覆盖暂停与播放时进入退出、画布和音频身份保持、双图旋转、34省标注、简称命中后详情全称、600px边界、原生全屏与浏览器退出、接口缺失／拒绝、迟到成功、滚动及键盘焦点、24:00停止与同日重播。

回归首次发现两个手机测试仍固定截图四张画布；附图移除后不存在第三张画布，导致测试超时。已将截图循环改为实际画布数量，桌面、手机WebKit和手机Chromium三项目复验通过。回归统计按不同项目场景去重，包含修复后通过的两个手机场景。

复现命令：

```sh
npm run test:unit
npm run build
npm run test:e2e -- tests/e2e/fullscreen.spec.ts
npm run test:e2e -- tests/e2e/controls.spec.ts tests/e2e/explorer.spec.ts tests/e2e/startup.spec.ts tests/e2e/audio.spec.ts
node scripts/static-check.mjs --fullscreen-mobile --audio-timeline
```

生产检查覆盖1440×900、768×1024、844×390、360×800、390×844、600×900和601×900，设备时区设为纽约。确认全屏与视口等大、双图按方向排列、无地图区域滚动，手机无附图，退出保持时刻、主画布及音频实例。真实MP3位于本站`/atlas/assets/`、返回`audio/mpeg`，曲长265秒、循环开启、播放速率为1，暂停后媒体停止。

生产版本不依赖Vue开发实例元数据；34省渲染数量在开发浏览器测试中断言，生产显示另通过截图复查。结果见[生产检查JSON](validation-images/fullscreen-mobile/static-production.json)。

## 截图复查

已复查普通手机零点／白天、全屏昼夜交界、双图竖屏／横屏和桌面全屏：省级简称可见，日期时间与按钮完整，手机没有附图及其留白，全国主体、海南和港澳台保留。

- [手机普通零点](validation-images/fullscreen-mobile/mobile-chromium-normal-midnight.png)
- [手机普通白天](validation-images/fullscreen-mobile/mobile-chromium-normal-noon.png)
- [手机全屏昼夜交界](validation-images/fullscreen-mobile/mobile-webkit-fullscreen-transition.png)
- [手机全屏双图竖屏](validation-images/fullscreen-mobile/mobile-chromium-fullscreen-compare.png)
- [手机全屏双图横屏](validation-images/fullscreen-mobile/mobile-webkit-landscape-compare.png)
- [桌面全屏双图](validation-images/fullscreen-mobile/desktop-chromium-fullscreen-compare.png)
- [生产手机双图](validation-images/fullscreen-mobile/production-fullscreen-390.png)

## 验证边界

手机结果来自浏览器尺寸及触控模拟，未做真实iPhone／Android、物理刘海安全区或扬声器听感验证。原生全屏实测使用桌面Chromium，手机WebKit验证可视区域模式及模拟接口失败／迟到结果。未进行性能长测、数据重建或外部部署。
