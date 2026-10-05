# 中国昼夜地图：iPhone 与 TestFlight 操作指南

## 当前交付范围

Capacitor 8 + Vue + 安装包内资源，iPhone、iOS 17 起，支持横竖屏。按用户最新决定，当前只做自己的 iPhone 真机安装，TestFlight 暂缓；本文保留 TestFlight 步骤供以后使用，现在无需执行。整个计划不创建公开链接、外部测试组或 App Store 发布版本。此范围取代早期调研中的分享、公开上架和 iPad 专项交付建议。

**本文件是操作说明，不是 App 安装文件。真正用 Xcode 打开的工程是 `ios/App/App.xcodeproj`。** Xcode 会把工程编译并签名，再安装到已连接的 iPhone；不需要把 Markdown、HTML 或工程文件传到手机。

完整 Xcode 26 或更新兼容版本、Node.js 22+ 是构建前提。本机本轮使用 Xcode 27.0 / iOS 27 SDK，具体已验证内容见 `validation-ios-app.md`。iOS 17 最低版本配置不等于已覆盖 iOS 17 运行测试。

## 工程与资源

| 路径 | 用途 |
| --- | --- |
| `ios-app.json` | Bundle ID、App 版本、build number 的唯一维护入口 |
| `capacitor.config.ts` | 本地 `dist-ios`，没有远程 `server.url` |
| `ios/App/App.xcodeproj` | Xcode 原生工程，Swift Package Manager 依赖 |
| `src/platform/runtime.ts` | Preferences、应用状态、状态栏和系统浏览器 |
| `scripts/prepare-ios-web.mjs` | 拷贝完整 assets 和入口，汇总许可证，检查资源引用 |
| `scripts/configure-ios.mjs` | sync 后统一 iPhone、iOS 17、版本、构建号，保留用户选择的签名团队 |
| `dist-ios/app-resources.json` | 资源清单，随构建生成 |
| `ios/App/App/PrivacyInfo.xcprivacy` | 无追踪、无上传采集；主题及音乐使用 UserDefaults，原因 CA92.1 |

网站仍用 `npm run build` 生成 `dist/`，保留 `base: './'` 与现有地图静态数据。App 复制所有 Vite assets，包括全国几何、延迟加载的日历和唯一音乐；排除页面不使用的 `maps/` 副本，不删减全国数据。

```sh
npm ci
npm run ios:sync
npm run ios:open
```

首次克隆也不必再次 `cap add ios`，原生工程已保存在仓库。每次网页改动后必须 sync，再由 Xcode 构建；单独点击 Run 不会自动更新网页包。不要在生产配置设置网站 URL。

`ios:sync` 同时校验网站、`dist-ios` 与原生工程内15个网页资源的 SHA-256（数量随资源更新而变化）。可单独执行 `node scripts/check-ios-resources.mjs` 检查同步状态。日期与节气统一采用 H5 同行括号样式；只刷新网站不会更新已经安装的 App，仍需重新构建并安装。

## 第一次安装到自己的 iPhone

### 1. 打开正确的工程

在 Mac 的终端执行：

```sh
cd /Users/apple/work/workspace/codex-api
npm run ios:sync
npm run ios:open
```

当前电脑已经安装依赖，不需要重复执行 `npm ci`。`ios:sync` 将最新页面、地图和音乐装入原生工程；`ios:open` 打开 Xcode。也可在 Finder 中进入 `ios/App/`，双击 `App.xcodeproj`。本项目采用 Swift Package Manager，直接打开这个工程即可。

### 2. 登录 Apple 账户

Xcode 菜单 → Settings → Apple Accounts（部分版本称 Accounts），添加自己的 Apple 账户，完成登录。密码、双重认证和协议确认由本人操作。没有付费开发者会员时，账户对应的团队显示为 `你的名字 (Personal Team)`；当前自用安装可以先使用这个团队。

### 3. 连接、信任和准备手机

用支持数据传输的线连接 iPhone 与 Mac，保持手机解锁；手机出现“要信任此电脑吗”时，点“信任”并输入手机锁屏密码。

在 Xcode 顶部设备菜单选择真实手机。如果需要配对或设备尚不可运行，在设备菜单打开 Manage Devices…，或 Xcode → Open Developer Tool → Device Hub，选择 Physical Devices 下的手机并按界面提示完成准备。

若提示开发者模式未开启，在手机进入 **设置 → 隐私与安全性 → 开发者模式**，开启后按提示重启；重启解锁后再次确认启用。若没有这个入口，先让 Xcode 发起设备配对再检查。[Apple 开发者模式说明](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)。

设备显示 `Preparing…`、`Developer Mode disabled` 或命令行显示 `connected (no DDI)` 时，表示连接后还有设备开发准备要完成，不能把“已连接”当作“已可运行”。保持连接、解锁，查看 Device Hub 的具体提示，等待准备完成；若报系统支持或组件缺失，再处理对应提示。

### 4. 选择签名团队

在 Xcode 左侧点击最上面的蓝色 **App 工程**。中间选择 **TARGETS 下的 App**，再选择 **Signing & Capabilities**：

- 勾选 **Automatically manage signing**。
- **Team** 选择自己的 **Personal Team**；如果已有正式开发团队，也可选择本人有权限的团队。
- **Bundle Identifier** 当前为 `top.gdufe888.chinadaylight`，先保留，让 Xcode 自动处理开发签名。

签名用于告诉 iPhone 这个开发 App 来自哪个开发者，Xcode 自动管理时通常无需自己创建证书和描述文件。选择团队后，等待 Xcode 更新签名状态。[Apple 真机运行说明](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)。

如果出现 `Bundle Identifier is not available`，需要换成在你的团队下可用的唯一标识。修改根目录 `ios-app.json` 的 `appId` 后重新执行 `npm run ios:sync`；不要只在 Xcode 中修改，否则后续同步会恢复配置文件里的值。当前标识尚未在正式开发团队下核实或注册。

### 5. 选真实手机，点击运行

Xcode 顶部有两个选择：**Scheme 选 App**，旁边的**运行设备选自己的真实 iPhone 名称**。不要选择 Simulators 下的 iPhone，也不要选择 Any iOS Device；后者不是这次直接安装的运行目标。

点击左上角三角形 **Run**，或按 **Command + R**（菜单 Product → Run）。保持 Mac 联网、手机解锁并连接。Xcode 依次编译、签名、安装、启动，第一次可能要先完成依赖解析和设备准备。

成功后，手机会启动“中国昼夜地图”，主屏幕或 App 资源库出现它的图标。若手机提示“不受信任的开发者”，按系统提示进入 **设置 → 通用 → VPN 与设备管理**，找到本次自己的开发者条目并确认信任，再回 Xcode 重新 Run；没有这个提示则不用做这一步。

### 6. 安装后独立使用及离线验收

先确认从 Xcode 启动成功，然后回到手机主屏幕；需要结束调试时，在 Xcode 点 Stop，再在手机点图标重新打开。此时可以拔掉数据线，应用资源在安装包内，不需要 Mac 运行网站服务。

开启飞行模式并确认 Wi-Fi 关闭，重新从图标打开，检查地图、日历、节气、详情、单双图和音乐。Xcode Run 会自动启动 App，因此这个操作验证的是“安装后的离线重开”；不能记录为“第一次打开前就断网”。严格的首次离线启动需单独控制只安装、不自动启动，按验收表另行记录。

### 7. 后续更新及免费签名到期

每次修改 Vue 页面后，在 Mac 重新执行 `npm run ios:sync`，再在 Xcode 选择同一台手机并 Run。无需先删除手机里的 App；使用同一 Bundle ID 覆盖安装可以保留现有偏好，仍需检查实际结果。

免费 Personal Team 的描述文件自签发起 **7 天到期**，到期后需要重新用 Xcode 构建和安装；因此自用安装目前无需购买会员，但也不是永久免维护安装。[Apple 免费账户限制](https://developer.apple.com/help/account/basics/about-your-developer-account/)。TestFlight 等以后再按下面的章节准备。

### 常见提示

| 提示 | 操作 |
| --- | --- |
| `Signing requires a development team` | 在 TARGETS → App → Signing & Capabilities 中选择 Team |
| `Developer Mode disabled` | 在手机开启开发者模式，完成重启后的确认 |
| 手机未出现在运行设备中 | 检查手机解锁、数据线、信任提示与 Device Hub 配对状态 |
| `Preparing…` 或 `no DDI` | 查看 Device Hub 的设备准备提示，等待开发支持准备完成 |
| Bundle Identifier 不可用 | 修改 `ios-app.json` 中的 `appId`，sync 后重试 |
| `Untrusted Developer` | 在手机按提示信任自己的开发者条目，再运行 |
| `Build Failed` | 按 Command + 5 打开问题列表，记录第一条红色错误；不要只凭警告数量判断失败原因 |

## 已实现的平台行为

- 主题与音乐使用 Preferences，Vue 挂载前完成读取。失败采用亮色、音乐开启；按键后的写入串行执行，不让迟到读取覆盖操作。网页继续使用 localStorage。
- 冷启动按北京时间今天 00:00、暂停，不恢复观测分钟。失活事件同步暂停地图与音乐，并取消等待中的节气自动播放；回前台不自动恢复。
- CSS 管理顶部、底部和横屏两侧安全区。iOS 使用现有沉浸布局及状态栏控制，保留地图和单一音频实例。
- GitHub 在系统 Safari 浏览器界面打开，关闭后返回 App。关于入口显示版本、构建号、数据模型、隐私及离线许可证。
- 保留 HTMLAudio 与累计秒数定位，不启用后台音频。静音开关、耳机与系统音频中断仍须真机确认；如果失败，再补必要音频会话处理。
- Capacitor 的 WKWebView 进程终止处理会重载页面，重载按冷启动规则暂停。已查阅框架实现，尚未完成终止故障注入验证。

## TestFlight 内部测试

1. 在正式团队下确定 Bundle ID；App Store Connect → My Apps 新建 iOS 应用记录，名称“中国昼夜地图”、主语言简体中文、同一 Bundle ID，SKU 使用团队内部唯一值。创建记录不代表公开发布。
2. 确认 App target 的 Release 签名团队、版本 `0.1.0` 和 build `1`。选择 Any iOS Device，Product → Archive。
3. Organizer → Validate App，然后 Distribute App → App Store Connect 上传。保留生成的 archive 和验证结果在本地，勿提交证书、私钥、描述文件和 archive 到仓库。
4. 构建处理完成后填 Beta App Description、What to Test 和你实际使用的反馈邮箱。只创建“自用测试”内部组，把本人作为 App Store Connect 团队内测试者加入；不建外部组或公开邀请链接。
5. 手机 TestFlight 安装本版本，重新验收离线、前后台、音乐、横竖屏。
6. 将 `ios-app.json` 的 buildNumber 改为 `2`（后续持续递增），执行 `npm run ios:sync`，重新 Archive、验证、上传，检查 TestFlight 更新后主题与音乐偏好保留，冷启动仍为暂停零点。

出口配置 `ITSAppUsesNonExemptEncryption=false` 基于当前实现没有自定义加密、外链 HTTPS 由系统浏览器提供的判断。Apple 将常见操作系统内置加密列为通常免于文档上传的情形；以后加入额外 SDK 或自定义加密需重新评估。[Apple 加密声明说明](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)。隐私清单中 Preferences 的原因来自其[官方说明](https://capacitorjs.com/docs/apis/preferences)。上传时以实际构建和 Apple 校验结果为准。

建议测试说明：

> 中国昼夜地图 0.1.0。请测试首次离线启动、日期与节气、单双图切换、时间轴和钢琴音乐同步、横竖屏与全屏、锁屏及返回暂停。反馈附设备型号、iOS 版本、所选日期与北京时间、操作步骤和截图。此版本只供本人内部测试。

## 真机验收记录模板

设备型号：____；iOS 版本：____；Team：____；Bundle ID：____；版本／build：____；日期：____。

| 场景 | 必须观察到的结果 | 实际结果／证据 |
| --- | --- | --- |
| 首次启动前断网 | 地图、日历、节气、详情、双图与真实音乐均可用 | 待真机 |
| 日期与 24:00 | UTC+8；24:00 不更换所选日期；冷启动今天零点暂停 | 待真机 |
| 单双图及音乐 | 时间轴与选区共享，只有一份音频，无残留地图实例 | 待真机 |
| 手动定位与快慢分段 | 拖动暂停，音乐按累计秒数定位 | 待真机 |
| 锁屏、切 App、音频中断 | 无遗留声音；返回不自动播放 | 待真机 |
| 静音开关与耳机切换 | 系统静音与中断行为符合预期，实际听感正常 | 待真机 |
| 横竖屏、全屏、日历 | 避开刘海及 Home 区，省名能读能点 | 待真机 |
| 音乐失败、图形丢失 | 音乐失败不阻断地图；图形可手动重试，无无限重试 | 待真机 |
| WebView 内容进程终止 | 自动重载，恢复冷启动暂停状态 | 待真机 |
| 连续操作播放 10 分钟 | 无崩溃或持续白屏，反复切换后内存不持续阶梯增加 | 待真机 |
| TestFlight 更新 | build 2 安装成功，主题与音乐偏好保留 | 待 TestFlight |

记录五次冷启动的地图可见时间和播放就绪时间；记录单／双图帧时间与内存、复现步骤及截图。先建立参考设备基线，未测项目保持“待验证”。保留 `preserveDrawingBuffer` 与现有 MapLibre 主版本，全国几何不简化；性能参数只在真机测量后决定是否调整。

## 复核命令

```sh
npm run typecheck
npm run test:unit
npm run ios:sync
npm run test:ios:web
node scripts/check-ios-web.mjs --website
npm run test:e2e -- tests/e2e/startup.spec.ts tests/e2e/audio.spec.ts tests/e2e/controls.spec.ts --project=desktop-chromium --project=mobile-webkit --output=/tmp/daylight-ios-e2e
```

`test:ios:web` 只允许 App 包文件和本地 Blob 工作线程，检查生产 WebKit、日历延迟加载与真实 MP3。它通过本地 HTTP 挂载资源，不能证明真实 iPhone 的首次离线安装、静音、耳机或性能。模拟器构建无需开发团队；真机和 TestFlight 必须完成相应签名。
