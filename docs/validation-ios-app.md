# iOS 接入验证记录 · 2026-10-05

## 实施状态

已建立可构建、可在 iPhone 模拟器安装的 Capacitor 8 工程，完成离线资源打包、iPhone 安全区、原生应用状态、Preferences、状态栏、系统浏览器和关于入口。版本为 `0.1.0 (1)`；开发 Bundle ID 为 `top.gdufe888.chinadaylight`，尚未在正式团队下注册核实。

| 计划阶段 | 本轮实际状态 |
| --- | --- |
| Xcode 环境 | 已定位完整 Xcode、SDK 和模拟器；实体 iPhone 配对、账户和签名待完成 |
| 首个本地资源 App | 模拟器安装启动成功；资源包与延迟加载检查通过；首次真机断网启动待完成 |
| iPhone 平台适配 | 已实现；静音、耳机与音频中断仍待真机确认 |
| 真机验收 | 未执行，不用模拟器替代 |
| TestFlight 内部上传及第二次更新 | 未执行，需要正式开发团队、应用记录和测试联系邮箱 |

## 环境与原生构建

- Node.js 22.23.3；Xcode 27.0（27A266a）；iPhoneOS / Simulator SDK 27.0。
- iPhone 17 模拟器，iOS 27.0（24A434）。它是模拟设备，不是已连接的实体手机。
- Capacitor core / CLI / iOS 固定 8.5.2；App 8.1.2、Browser 8.0.5、Preferences 8.0.1、Status Bar 8.0.3；SPM 框架锁定 8.5.2。
- `npm run ios:sync` 通过。网页包 15 个资源文件，约 9.48 MB，另有生成的资源清单；不带 `maps/` 副本，完整全国几何仍在构建 assets 内。
- Xcode Debug / iphonesimulator、Release / iphoneos 编译均 `BUILD SUCCEEDED`，使用 `CODE_SIGNING_ALLOWED=NO`。Release 编译成功不代表签名、Archive 校验或上传成功。
- Info.plist、PrivacyInfo.xcprivacy 和 project.pbxproj 通过 plutil 检查；图标为 1024×1024、不带 Alpha。App target 只含 iPhone，最低 iOS 17。

日志本机保存在 `/tmp/daylight-ios-build.log`、`/tmp/daylight-ios-release.log`，不是长期仓库证据。原生工程与依赖锁定文件保存在 `ios/`；资源、DerivedData、个人签名和 archive 忽略。

## 自动化验证

| 检查 | 实际结果 |
| --- | --- |
| Vue / TypeScript | 通过 |
| 单元测试 | 本轮最终运行 11 文件、72 项通过；包含并行工作带来的地图及节气测试。iOS 新增 5 项平台边界及 1 项原生失活播放测试 |
| 网站回归 | startup、audio、controls 在 desktop-chromium / mobile-webkit 两项目共 36 项通过，独立输出 `/tmp/daylight-ios-e2e` |
| App 生产资源包 | Playwright WebKit 手机视口检查通过，所有请求限制到 `/atlas/` 本地包及本地产生的 Blob 工作线程 |
| 网站生产 `/atlas/` | 同样的 WebKit 生产检查通过，纽约设备时区下维持北京时间语义 |

生产检查实际覆盖：今天零点暂停；延迟加载日历；双图；24:00 日期不变；真实 MP3 解码、循环、正常速率及暂停；横屏全屏；退出保留地图画布；重新加载归零；无 maps JSON、外部运行资源或 HTTP 错误。MP3 实际曲长 **265.038367 秒**。

资源包结果见 [package-webkit.json](validation-images/ios-app/package-webkit.json)，网站结果见 [website-subdirectory.json](validation-images/ios-app/website-subdirectory.json)。本地 HTTP 资源检查不能等同于实体手机首次断网启动。

首轮网站测试输出被其他并行任务清理，产生 trace 文件缺失；改用独立目录后 36 项通过。新生产检查脚本初轮误拦截本地 Blob 工作线程、使用旧日历类名，以及缺少音频 Range 响应，已修正测试工具并重跑通过；这些失败不能作为产品白屏或音频故障的证明。

## 原生模拟器实际操作

已实际安装启动，屏幕确认：

- 今天零点暂停，地图与底部时间轴可见；主题切换同时更改状态栏文字颜色。
- 关于窗口显示中文名称、版本与构建号、数据、隐私与许可说明。
- 关闭音乐后地图仍推进；播放中按 Home 离开，再回到同一进程，保持在离开时刻附近且显示播放按钮，没有自动恢复。
- 单图沉浸全屏隐藏状态栏，保留日期时间和操作；旋转到横屏后地图重新拟合，无南海附图；观测时刻与暂停状态保留。
- 替换安装同一 build 的新本地资源后，暗色主题与音乐关闭保留，观测时刻归为 00:00、保持暂停。这只验证本地模拟器替换安装，不证明 TestFlight 更新。
- 修复初始布局中海岛注记依赖工作线程瓦片数据导致的重叠；改为读取随程序提供的标注数据，手机显示“钓鱼岛”，保留地图几何与天文输入。
- GitHub 已在原生系统浏览器内打开，关闭回到原观测页。测试发现 StatusBar 插件的 viewDidAppear 重置默认样式，已在浏览器关闭和回前台时恢复当前主题，并补单元覆盖；重建安装后再次打开／关闭浏览器，屏幕确认恢复白色状态栏文字。

截图在 [ios-app](validation-images/ios-app/)：`simulator-about-dark.png`、`simulator-fullscreen-portrait.png`、`simulator-updated-portrait.png`、`simulator-updated-landscape.png`、`simulator-final-dark.png`。早期截图与更新后截图对应不同轮次资源；不能据截图认定所有尺寸标签均无拥挤。

## 尚未验证与继续条件

实体 iPhone 首次离线、真实扬声器与听感、静音开关、耳机切换、锁屏及系统音频中断；双图真机性能、五次冷启动计时和 10 分钟内存基线；iOS 17 运行兼容性；主动终止 WKWebView 内容进程后的恢复；正式签名、Archive 验证、App Store Connect 构建处理及 TestFlight build 2 更新均待执行。

框架源码的 WebViewDelegationHandler 已确认内容进程终止时 reset + reload，产品重载初始化会保持暂停；这属于实现检查，不是故障注入测试。

下一步连接 iPhone，完成信任／开发者模式；在 Xcode 登录账户并选自己的 Team。随后按 [操作指南](ios-development.md) 的验收表完成真机和 TestFlight，补录实际设备、团队、联系信息和证据，不以当前报告标记全部计划完成。
