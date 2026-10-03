# 前轮功能改版实际验证记录

后续清透日光观测台布局与视觉改版请阅读 [本轮验证记录](validation-observatory.md)。本文件保留前轮证据。

日期：2026-10-03。对应 [用户批准规格](plans/2026-10-03-redesign.md)。未执行 git commit／push，未发布到外部网站。

## 自动检查

| 检查 | 结果 | 覆盖 |
| --- | --- | --- |
| `npm run data:check` | 通过 | 3253 官方节点、父子关系、34省、原始几何逐值保真、SHA-256、重要海岛范围 |
| `npm run typecheck` | 通过 | Vue／TypeScript 全工程 |
| `npm run test:unit` | 29 项通过 | 北京时间、闰日、一年范围、两态、太阳事件、节气、全国几何、分段积分、缓存、真实层级 |
| `npm run test:e2e` | 19 项通过，8 项按项目条件跳过 | 桌面Chromium、360px触控Chromium、390px触控WebKit；4个桌面专项在两个手机项目不重复执行 |
| `npm run build` | 通过 | 完整静态 `dist/`，无需后端与 API Key |

真实地图点击流程：全国 → 湖南省 → 放大到市界比例 → 长沙市；检查市界完整包含在可视边界内、按钮不可放大、电脑滚轮和手机双指扩张不可越过锁定上限、缩小后仍可放回上限、两天共用中心／缩放／上限、回省和全国解除锁定。实际地图点击另核验台湾省 → 高雄市官方对应层级、北京市停止省级。内地县界请求为0。

节气／日期流程：24名称和年月日完整；点击夏至自动播放、暂停后普通换日保留时分；开启两天对比，指定节气应用日期2；快速切换最后一次生效；后台暂停且返回不自动恢复；越界和清空输入与实际日期一致。无旧搜索、时间滑块、晨昏、县级选择、速度与循环控件。

资源和图形故障：全国数据／地图资源失败有提示和重试；主图、南海附图分别丢失WebGL上下文后重建canvas恢复；迟到市级请求不能清除图形恢复提示；无WebGL时明确报错。首帧就绪等待实际绘制后解除加载状态。

浏览器尺寸：桌面1440×1000、Chromium触控360×800、WebKit触控390×844（iPhone 13配置）。手机验证是浏览器引擎／视口／触控模拟，未冒称真实iPhone、Android硬件测试。

## 静态运行与时区

正式 `dist/` 在 `/atlas/` 静态子目录验证1440×900、768×1024、844×390三种布局，日期／节气／双图正常，无横向溢出、页面或地图错误。设备时区设为 `America/New_York`，日期仍为北京时间日期。外部资源请求为0，地图及工作线程均来自本站。见 [static-production.json](validation-images/static-production.json)。

## 天文与全国变速

CPU详情、GPU遮罩和全国播放使用同一Astronomy Engine 2.1.19太阳向量。太阳中心几何高度≥−0.8333°为白天，低于阈值为黑夜；海平面模型，不重复施加折射。抗锯齿只在边缘极窄范围内，不产生晨昏带。

9个代表地点、3个日期的135组太阳高度与库观测者坐标变换相差小于0.02°；日出日落与独立求根接口相差小于2分钟。采用 [NOAA公开算法](https://gml.noaa.gov/grad/solcalc/main.js)生成27组独立日出日落参考，最大差值约0.023分钟（约1.4秒）。这是算法比较，不表示天气／地形下实际观测精度。极地无事件有明确空值和正确昼长。

24节气按视黄经每15°求根，与 [香港天文台说明](https://www.hko.gov.hk/sc/gts/time/24solarterms.htm)及 [2026年官方中气表](https://www.hko.gov.hk/tc/gts/astron2026/files/2026SolarTerms24.pdf)核验。12个中气时刻误差均小于1分钟；最近一年窗口正确选择2026夏至与2025冬至，窗口外选项禁用。

全国数据含全部省级多部件的所有闭合边界顶点，对长边沿渲染采用的Mercator直线加密至≤0.05°，并检查太阳／反太阳点落在面内时的内部极值。阈值留0.01°保守余量，切换时刻二分至0.5秒。夏至、冬至全天分段连续覆盖0—1440分钟，均为60／10／60／10／60；单位为分钟／秒。双图合并只要任一天慢放就慢放，跨段按实际耗时积分，缓存8个日期，逐帧不扫描全国几何。

## 版图与视觉证据

本轮未改写官方源数据、边界坐标或分类。行政目录完整3253节点保留，界面只浏览34省+333地级节点+台湾20对应节点，共387个节点。特殊层级及来源详见 [coverage.md](data/coverage.md)、[provenance.md](data/provenance.md)。保留港澳台、南海诸岛、钓鱼岛及附属岛屿和官方8个境界线要素；南海附图按真实经纬度独立计算昼夜。

已生成13张最终截图，无页面脚本错误；资源清单见 [resources.json](validation-images/resources.json)。

- [全国昼夜交界](validation-images/national-dawn.png)、[全国正午](validation-images/national-noon.png)、[全国黑夜](validation-images/national-night.png)
- [夏至／冬至双图](validation-images/compare-seasons.png)、[长沙市终点与详情](validation-images/city-changsha.png)
- [手机WebKit](validation-images/mobile-webkit.png)、[手机WebKit日期面板](validation-images/mobile-webkit-panel.png)
- [360px手机Chromium](validation-images/mobile-chromium.png)、[360px日期面板](validation-images/mobile-chromium-panel.png)
- [平板](validation-images/tablet.png)、[平板面板](validation-images/tablet-panel.png)、[横屏](validation-images/landscape.png)、[横屏面板](validation-images/landscape-panel.png)

太阳全国判定数据为77,246个边界采样点、557个多部件面。本机Node单日预计算约25—34ms，夏至／冬至单图完整播放分别约68.02／67.56秒；是本机计算记录，不代表手机耗时。详见 [playback-segments.json](validation-images/playback-segments.json)。

全部地图原始静态文件约17.58MB，首屏5个地图数据文件解码体积约3.32MB，后续只按视野读取市界（台湾对应层级例外）。两图共用Promise缓存，不逐帧联网读取。截图资源表包括随后点击城市产生的市界请求，不能把该清单总量视作首屏大小。

## 十分钟重复播放

正式构建，全国夏至／冬至双图，默认60／10自动变速，完整运行600秒。产品到24:00停止，测试脚本通过可见播放按钮重启下一轮，共重启6轮；日期始终不变。10次采样document.hidden均为false，无页面或地图错误，播放期间新增地图请求为0。见 [performance.json](validation-images/performance.json)。

机器：MacBook Pro，Apple M5 Pro，24GB内存。长测浏览器为独立Headless Chromium 153／SwiftShader软件渲染，不能将此模式的帧率代表真实GPU或手机。每分钟rAF约9.58—11.18次／秒，p95帧间隔133.3—150ms。JS heap起始82.6MB，分钟采样34.0—81.0MB，结束37.3MB，采样未观察到持续增长。记录的是JS heap，不是GPU内存或全部进程内存。

完整Chromium 153无窗口模式对照实际使用Apple M5 Pro／ANGLE Metal，30秒内1,801次rAF，约60.03次／秒，p95帧间隔16.7ms。JS heap从47.9MB到54.4MB；此短测不用于断言长期显卡内存表现。无页面或地图错误，新增地图请求为0。见 [performance-chromium-quick.json](validation-images/performance-chromium-quick.json)。

复现：开发预览5173与正式预览4173启动后，执行 `node scripts/visual-check.mjs`、`node scripts/static-check.mjs`、`node scripts/performance-check.mjs`；性能脚本默认十分钟，`--quick`为30秒，`--full-chromium`选择完整Chromium二进制。所有计时结果以文件内实际浏览器模式与renderer为准。

## 审查

按 ai-review 技能完成只读审查，未发现可复现Critical／Important问题。核对全国几何与变速、跨段积分、双图同步、特殊层级、最后节气选择、后台暂停、异步失败及重试。最终截图及600秒性能验证已完成。

可选提交信息草稿，未执行提交：

```text
feat: 简化中国昼夜观测并增加节气自动播放

以真实市级边界作为浏览终点，统一昼夜两态与全国转场自动变速，支持三栏和移动端面板。
```
