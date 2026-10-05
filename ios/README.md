# 中国昼夜地图 iOS 操作手册

## 选择你现在要做的事

| 目的 | 从哪里开始 | 账户要求 |
| --- | --- | --- |
| 更新自己手机上的 App | [代码更新后重新安装](#代码更新后重新安装) | 免费 Personal Team 可以使用 |
| 通过 TestFlight 安装和更新 | [第一次使用 TestFlight](#第一次使用-testflight) | 有效的 Apple Developer Program 会员 |
| 让用户从 App Store 下载 | [第一次上架 App Store](#第一次上架-app-store) | 有效会员、App Store Connect 和 App Review 审核 |

你已经完成第一次真机安装，后续按“代码更新后重新安装”操作。TestFlight 和上架步骤留到需要时执行。

## 打开工程与第一次真机安装

### 1. 准备电脑并打开工程

电脑需要完整 Xcode 和 Node.js 22 或更新的兼容版本。当前项目支持 iPhone，最低系统为 iOS 17。

打开 Mac 的终端，执行：

```sh
cd /Users/apple/work/workspace/codex-api
npm run ios:sync
npm run ios:open
```

这台电脑已有依赖。以后换电脑或重新克隆仓库，先在项目根目录执行一次 `npm ci`，再执行上面的同步和打开命令。项目放在其他目录时，将 `cd` 后面的路径换成实际位置。

`ios:sync` 会构建 Vue 页面，把资源复制到 iOS 工程，并同步原生依赖和版本设置。等终端执行成功后再运行 Xcode。

用 Xcode 打开 [App/App.xcodeproj](App/App.xcodeproj)，也可以在 Finder 中双击它。项目使用 Swift Package Manager，不需要另外创建 iOS 工程或安装 CocoaPods。

### 2. 登录账户并选择签名团队

1. 在 Xcode 菜单打开 Settings，再进入 Apple Accounts。部分版本将这一页称为 Accounts。
2. 添加自己的 Apple 账户，完成登录和双重认证。
3. 在 Xcode 左侧点击最上面的蓝色 App 工程。
4. 在中间列表选择 TARGETS 下的 App。
5. 打开 Signing & Capabilities，勾选 Automatically manage signing。
6. 在 Team 选择自己的团队。免费账户显示为 `你的名字 (Personal Team)`。
7. Bundle Identifier 先保留 `top.gdufe888.chinadaylight`。

Xcode 会按所选团队生成开发签名。登录、双重认证和协议确认由你本人完成。

### 3. 准备 iPhone

1. 用支持数据传输的数据线连接 iPhone 和 Mac，解锁手机。
2. 手机出现“信任此电脑”时，确认信任并输入锁屏密码。
3. 在 Xcode 顶部运行设备菜单选择自己的真实手机。你的手机目前名为“我的iphone”。
4. 如果手机提示开发者模式未开启，在手机打开“设置 / 隐私与安全性 / 开发者模式”。开启后按提示重启，重启解锁后再次确认启用。
5. 保持连接，等待 Xcode 完成设备准备。第一次可能显示 Copying OS library symbols 或 Extracting OS library symbols。

找不到开发者模式入口时，先在 Xcode 发起设备配对，再检查手机设置。查看设备状态可以从 Xcode 的运行设备菜单打开 Manage Devices…，或选择 Xcode / Open Developer Tool / Device Hub。旧版 Xcode 的设备管理窗口称为 Devices and Simulators。[Apple 开发者模式说明](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)、[Device Hub 说明](https://developer.apple.com/documentation/xcode/managing-your-simulated-and-physical-devices-in-device-hub)。

### 4. 编译、安装和运行

1. 确认 Xcode 顶部 Scheme 为 App，运行设备为自己的 iPhone。
2. 点击左上角的三角形 Run，或按 `Command + R`。
3. 如果出现 `Replace “App”?`，点击 Replace，结束上一轮运行并启动新的实例。
4. 保持手机解锁，等待 Xcode 编译、签名、安装和启动。
5. 如果提示 Developer App Certificate is not trusted，在手机进入“设置 / 通用 / VPN 与设备管理”，找到自己的开发者条目，确认信任。回到 Xcode 关闭提示，再按 `Command + R`。
6. 手机打开“中国昼夜地图”后，检查地图是否显示、播放是否可用。

看到 Build Succeeded 后，还要等设备准备和安装完成，并处理手机上的证书信任提示。选中模拟器时，Run 会把应用装到 Mac 上的模拟器；真机安装要选择 Devices 下的手机。[Apple 真机运行说明](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)。

### 5. 拔线后使用

在 Xcode 点 Stop 结束调试，再从手机主屏幕或 App 资源库打开“中国昼夜地图”。此时可以拔掉数据线，地图和音乐已经在安装包内，电脑不需要运行开发服务器。

免费 Personal Team 的描述文件自签发起 7 天到期。到期后按下一节的更新步骤重新构建和安装。[Apple 免费账户限制](https://developer.apple.com/help/account/basics/about-your-developer-account/)。

## 代码更新后重新安装

### 每次更新都这样操作

1. 保存代码。如果是从 Git 拉取更新，先完成拉取；依赖清单或锁定文件变化时，再执行 `npm ci`。
2. 在项目根目录运行：

   ```sh
   cd /Users/apple/work/workspace/codex-api
   npm run ios:sync
   ```

3. 等命令成功结束。若出现类型检查或构建错误，先解决终端里的错误，再继续。
4. Xcode 没有打开时，执行 `npm run ios:open`。
5. 连接并解锁 iPhone，在 Xcode 顶部选择 App 和“我的iphone”。
6. 按 `Command + R`；出现 Replace 提示时点击 Replace。
7. 等应用启动，在手机检查本次修改。测试完成后结束调试，从手机图标重新打开一次。

只点击 Xcode Run，不会重新构建 Vue 页面。网页代码更新后必须先执行 `npm run ios:sync`。这个项目没有热更新服务，手机上安装的内容来自本次构建。

保持同一个 Bundle ID 并覆盖安装，通常可以保留主题和音乐开关。无需先删除手机上的旧 App；卸载会清除本地偏好。

只修改原生 Swift 文件时，可以直接在 Xcode Run。修改版本、应用标识、Capacitor 配置或依赖后，重新执行 `npm run ios:sync`。日常真机更新不要求每次递增版本号。

### 怎样确认手机安装的是新代码

先检查你刚修改的界面或行为。需要明确区分安装包时，在根目录的 [ios-app.json](../ios-app.json) 中递增 `buildNumber`，同步并重新安装，然后打开 App 的“关于”查看构建号。

## 版本号与构建号怎么改

当前配置在项目根目录的 `ios-app.json`：

```json
{
  "appId": "top.gdufe888.chinadaylight",
  "version": "0.1.0",
  "buildNumber": 1
}
```

| 字段 | 用途 | 修改规则 |
| --- | --- | --- |
| `appId` | App 的 Bundle ID | 确定后保持稳定；App Store Connect 记录使用同一个标识 |
| `version` | 用户看到的版本，如 `0.1.0` | 发布新版本时修改，使用三段数字 |
| `buildNumber` | 区分不同安装包 | 每次上传 App Store Connect 前递增，建议跨版本也持续递增 |

如果还没有上传过，第一次可使用 `0.1.0`、build `2`，修复后用 build `3`。正式发布可以改为 `1.0.0`，构建号取已经使用过的最大值加 1。已经上传过的构建号不要重复使用。

修改后执行 `npm run ios:sync`。在 Xcode 的 General 页面核对 Version 和 Build。版本和 Bundle ID 都由同步脚本写入工程，仅在 Xcode 中修改会被下一次同步覆盖。App 的“关于”也读取同一份配置。

## 第一次使用 TestFlight

### 1. 开通正式会员并切换团队

1. 使用自己的 Apple 账户申请 [Apple Developer Program](https://developer.apple.com/programs/enroll/)，按页面要求完成身份核验、协议和付款。
2. 等会员生效，确认能进入 [App Store Connect](https://appstoreconnect.apple.com/)。
3. 在 Xcode 的 Apple Accounts 中刷新账户，必要时重新登录。
4. 打开 App target 的 Signing & Capabilities，保持自动签名，Team 改为自己的正式开发团队。

免费 Personal Team 可以真机开发安装；TestFlight 上传需要正式会员。若新团队无法使用现有 Bundle ID，先解决标识归属或唯一性，再创建应用记录。确定新标识时修改 `ios-app.json` 的 `appId` 并同步；更换标识会使手机将它识别为另一款 App，本地偏好不会自动迁移。

### 2. 注册 Bundle ID

1. 打开 [Apple Developer 账户](https://developer.apple.com/account/)，进入 Certificates, Identifiers & Profiles。
2. 进入 Identifiers，先查找 `top.gdufe888.chinadaylight`。如果正式团队下已有这个 App ID，直接使用。
3. 如果没有，点击加号，选择 App IDs，再选择 App 类型。
4. Description 填“中国昼夜地图”，Bundle ID 选择 Explicit，填写与你 `ios-app.json` 一致的标识。
5. 保留实际需要的能力，点击 Continue，核对后点击 Register。

当前应用没有推送、登录或支付功能，不需要为了上传而开启这些能力。[Apple App ID 注册步骤](https://developer.apple.com/help/account/identifiers/register-an-app-id/)。

### 3. 在 App Store Connect 创建应用记录

1. 登录 App Store Connect，进入 Apps（部分界面称 My Apps）。
2. 点击加号，选择 New App。
3. Platform 选择 iOS。
4. Name 填“中国昼夜地图”，Primary Language 选择简体中文。如果名称不可用，按页面提示处理。
5. Bundle ID 选择上一步的标识。
6. SKU 填一个账户内唯一的内部编号，例如 `china-daylight-atlas-ios`。它不会显示给用户。
7. 按实际团队成员设置访问权限，点击 Create。

如果无法创建，先检查 Account Holder 是否已接受 Business 页面要求的最新协议。创建应用记录后可以上传测试包，公开上架要另行提交审核和发布。[Apple 新建应用说明](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app)。

### 4. 在 Xcode 生成归档

1. 修改 `ios-app.json`，递增 `buildNumber`，保留这轮要测试的 `version`。
2. 执行 `npm run ios:sync`，成功后执行 `npm run ios:open`。
3. 检查 App target 的 Team 已是正式团队，自动签名开启，General 中的 Version 和 Build 正确。
4. 在顶部选 App，运行目标选 Any iOS Device (arm64)。归档时使用这个目标，日常真机 Run 时才选择具体手机。
5. 选择菜单 Product / Archive。
6. 等归档完成。Xcode 通常会打开 Organizer；没有自动打开时，选择 Window / Organizer。
7. 在 Archives 中选中刚生成的归档，核对应用标识、版本、构建号和创建时间。

Archive 是用于分发的归档，包含构建和调试信息。Run 成功不会自动产生供上传使用的归档。

上传前检查 Xcode 和 SDK 是否仍满足 [Apple 当前上传要求](https://developer.apple.com/news/upcoming-requirements/)。最低支持 iOS 17 是应用能运行的系统下限，不是上传时所用 SDK 的版本。

### 5. 验证并上传归档

1. 在 Organizer 中选择归档，若有 Validate App，先执行验证并处理错误。
2. 点击 Distribute App。
3. 新版 Xcode 选择 TestFlight & App Store。较旧界面选择 App Store Connect，再选择 Upload。
4. 按向导选择正式团队和自动分发签名。核对 Bundle ID、版本和构建号。
5. 如果向导提供 Manage version and build number，取消自动调整，沿用 `ios-app.json` 中已经递增的构建号，避免原生包与“关于”的显示不一致。
6. 完成向导中的验证，处理阻止上传的错误，再点击 Upload。
7. 等到显示上传成功，保存这份归档，方便以后定位崩溃和回查版本。

选择 TestFlight & App Store 后，可以把经过测试的构建用于正式审核。TestFlight Internal Only 上传的构建仅供内部组使用，不能提交外部测试或正式上架；如果此前选了它，用新的构建号重新归档并按普通方式上传。上传完成后，到 App Store Connect 配置测试或提交审核。[Apple 归档与分发说明](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)。

### 6. 等构建处理并填写测试信息

1. 回到 App Store Connect，打开应用的 TestFlight 页。
2. 找到刚上传的版本和构建号，等待 Processing 完成。
3. 如果收到处理失败邮件或页面出现错误，按具体内容修复；修改安装包后递增构建号再上传。
4. 如果显示 Missing Compliance，打开该构建的合规问题，按实际加密使用情况回答。
5. 在 Test Information 中填写测试版描述和实际接收反馈的邮箱。

当前 `Info.plist` 的 `ITSAppUsesNonExemptEncryption` 为 `false`，依据是现有应用没有自定义加密，外链由系统浏览器处理。以后加入加密库或新的 SDK，重新检查声明，不要照抄旧答案。[Apple 加密声明说明](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)。

测试描述可以写为：

> 中国昼夜地图支持离线查看全国昼夜变化、日期与节气选择、两日对比和钢琴音乐播放。请检查离线打开、时间轴、音乐、横竖屏和锁屏后返回的行为。反馈时附设备型号、系统版本和复现步骤。

### 7. 把自己加入内部测试

1. 在 TestFlight 页的 Internal Testing 旁点击加号。
2. 创建“自用测试”组。第一轮建议关闭自动分发，手动确认每次要测试的构建。
3. 打开这个组，点击 Invite Testers，选择自己对应的 App Store Connect 用户，再点击 Add。
4. 点击 Add Builds，选择刚处理完成的构建。
5. 填写 What to Test，例如“检查首次离线打开、音乐暂停和横竖屏布局”，再添加构建。
6. 在 iPhone 的 App Store 安装 Apple 的 TestFlight。
7. 在手机上打开测试邀请，按提示接受，在 TestFlight 中点击 Install。
8. 从手机打开“中国昼夜地图”，完成这轮测试。

内部测试者必须是有相应权限的 App Store Connect 用户。邀请非团队成员的朋友时，使用外部测试组。内部组无需外部 Beta 审核，但构建处理和合规仍要完成。[Apple 内部测试步骤](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers)。

首次从 Xcode 开发安装切换到 TestFlight 后，检查主题和音乐偏好是否保留。TestFlight 安装无需另行启用开发者模式。

### 8. 以后怎样更新 TestFlight

1. 修改代码并测试。
2. 在 `ios-app.json` 中递增 `buildNumber`，需要开新版本时也修改 `version`。
3. 执行 `npm run ios:sync`。
4. 在 Xcode 重新 Archive，按普通分发方式上传。
5. 等新构建处理完成，在“自用测试”组添加新构建，并写清本次修改。
6. 在手机 TestFlight 中点击 Update，安装后检查新功能和本地偏好。

每个 TestFlight 构建最多可测试 90 天。到期前上传并分发新的构建，手机再通过 TestFlight 更新。[Apple TestFlight 概览](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)。

### 以后需要邀请朋友时

1. 沿用已创建的内部组，在 External Testing 下新建外部组。
2. 添加普通分发方式上传的构建。
3. 按页面要求补齐 Beta 审核联系人、测试信息和审核说明。当前 App 无需登录，按实际情况填写。
4. 提交 TestFlight App Review，等构建获得外部测试许可。
5. 再按邮箱邀请测试者。需要公开链接时单独开启；仅邀请指定朋友时使用邮箱即可。

外部测试的首个构建需要 Beta 审核，后续构建是否再次审核由 Apple 决定。[Apple 外部测试步骤](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)。

## 第一次上架 App Store

### 1. 准备正式版本

1. 确认真实 iPhone 上的地图、日期、双图、音乐、横竖屏、全屏和后台暂停均可使用；记录未解决的问题。
2. 将 App 的“关于”中“iPhone 测试版”等文案改为与正式版本一致的说明。
3. 准备公开可访问的隐私政策页面和支持页面。隐私政策说明本地偏好、无账户和采集功能、主动打开外链时的行为，并提供联系方式。支持页面提供使用帮助和联系途径。
4. 在 App 内加入容易找到的隐私政策链接，例如放在“关于”中。现有本地隐私说明可以保留，但商店要求的公开 URL 也要准备。
5. 核对地图、音乐和依赖的授权资料，保留与本次发行对应的证明。现有许可记录见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。
6. 首个正式版本建议使用 `1.0.0`，在 `ios-app.json` 修改，构建号继续递增。
7. 同步、归档并上传。建议先用 TestFlight 验证这个 `1.0.0` 构建，再把同一构建选入正式版本。

当前仓库没有提供可直接填写的公开隐私政策 URL、支持 URL 或商店截图，需要在发布前补齐。隐私政策链接要同时出现在 App Store Connect 和 App 内。[Apple 审核指南的隐私要求](https://developer.apple.com/app-store/review/guidelines/#privacy)。

### 2. 准备商店截图

1. 先选定几个能说明功能的页面，建议包括全国地图、两日对比、节气选择和省级详情。
2. 在 Xcode 运行设备中选择受支持的 6.9 英寸 iPhone 模拟器，例如 iPhone 17 Pro Max，Run 启动。
3. 在 Device Hub 中打开要展示的页面，使用设备下方的 Screenshot 按钮保存截图。
4. 按商店要求检查像素尺寸。6.9 英寸组当前接受 `1320 × 2868` 等规格；上传前核对页面要求。
5. 每个截图组使用一致方向和尺寸，上传 PNG 或 JPEG；图片不要含透明通道。

你自己的 iPhone 16 截图可作补充，不能据此省略商店要求的截图组。当前 iPhone 应用可提供 6.9 英寸组；没有这一组时按要求提供 6.5 英寸组。不要只截 Mac 上的 Xcode 窗口。[Apple 设备截图说明](https://developer.apple.com/documentation/xcode/capturing-screenshots-and-videos-from-devices)、[商店截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)。

### 3. 填写应用和版本资料

1. 在 App Store Connect 的 Apps 中打开“中国昼夜地图”。
2. 进入 Distribution。部分界面使用 App Store 标签，在侧栏选择 iOS 版本。
3. 如果当前只有 `0.1.0` 草稿，按页面提供的 Version 字段改为 `1.0.0`；已有发布版本时，用版本旁的加号新建版本。
4. 在 App Information 填写名称、字幕、主分类和内容权利。这个项目可以从 Education 分类考虑，按最终用途确认。
5. 完成年龄分级问卷，按实际功能回答，由 Apple 计算分级。
6. 在 `1.0.0` 版本页上传截图，填写描述、关键词、支持 URL、版权信息，以及页面要求的其他资料。
7. 在 Build 区域选择已经上传、处理完成并测试过的 `1.0.0` 构建。版本号必须对应，`0.1.0` 构建不能直接当作 `1.0.0` 提交。
8. 每次填写后点击 Save。

描述可围绕实际功能写：全国昼夜变化、北京时间、两日对比、节气、代表点的日出日落和离线使用。不要写成实时天气服务，也不要将代表点结果描述为整省统一的日出日落时间。[Apple 年龄分级说明](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)。

### 4. 填写隐私和审核联系方式

1. 在侧栏进入 App Privacy，填写公开隐私政策 URL。
2. 点击 Get Started，核对这个发布构建及其第三方依赖的数据处理情况。
3. 当前实现没有应用数据上传、广告或分析功能，主题和音乐偏好只保存在设备上；在确认发布构建仍如此后，可以选择“不从此 App 收集数据”，保存并发布隐私回答。
4. 在版本页的 App Review Information 中填写真实联系人、邮箱和电话。
5. 当前 App 没有登录功能，不勾选 Sign-in required。
6. 在 Notes 写清操作方式和容易误解的行为，方便审核人员测试。

审核说明可以写为：

> 应用无需登录。地图、天文计算和音乐均随安装包提供。点击播放可观察一天的昼夜变化；拖动底部时间轴后保持暂停。两日对比使用同一时间轴。全部时间按北京时间解释。太阳事件只代表详情中标注的代表点。

隐私清单 `PrivacyInfo.xcprivacy`、App Store Connect 的隐私回答和公开隐私政策分别维护，填写其中一项不会自动完成其他两项。[Apple 隐私填写步骤](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)、[审核联系资料](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)。

### 5. 设置价格、地区和相关资料

1. 打开 Pricing and Availability，设置价格。首次发布建议选择 Free；如果决定收费，先完成对应协议、税务和银行资料。
2. 在 App Availability 选择 Specific Countries or Regions，勾选你实际要发行的地区，确认并保存。
3. 计划在中国大陆发行时，检查 App Information 中的 Availability in China mainland，按适用要求提供 ICP 备案及页面要求的资料。这个项目是否适用、如何办理需在发行时核实；不能根据离线运行自行认定免于要求。
4. 按 App Store Connect 提示声明 DSA trader status。若面向欧盟且属于经营者，补齐相应的联系方式和验证资料；根据实际身份填写。
5. 检查 Business 页面是否还有待接受的协议或需要补充的发行资料。

价格和地区属于正式发行时的决定，当前真机和本人 TestFlight 测试无需先确定。涉及中国大陆地图应用的发行资料，现有来源页面的审图号不能直接当成本 App 的审图号。[Apple 价格设置](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price)、[发行地区设置](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store)、[中国大陆资料要求](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)、[DSA 身份说明](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements)。

### 6. 提交审核

1. 在正式版本页复核截图、描述、隐私回答、审核联系人、发行地区和所选 Build。
2. 在 App Store Version Release 中选择 Manually release this version，再保存。首次发布建议手动控制上线时间。
3. 点击 Add for Review，把版本加入审核草稿。
4. 打开 Draft Submissions 或侧栏 App Review，检查草稿中的内容。
5. 点击 Submit for Review，提交草稿审核。
6. 留意状态与 Apple 的邮件。Waiting for Review 表示排队，In Review 表示正在审核。

Add for Review 只把内容加入草稿，后面的 Submit for Review 才会送出。TestFlight 测试通过也不等于正式 App Review 通过。[Apple 提交审核步骤](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)。

### 7. 审核通过后发布

1. 使用手动发布时，审核通过后版本进入 Pending Developer Release。
2. 先确认 TestFlight 测试完成、支持和隐私页面能访问、发行地区正确。
3. 在版本页点击 Release This Version，并确认发布。
4. 等待商店完成分发，再用所选发行地区的 Apple 账户检查 App Store 页面和下载安装。

发布后可能需要最长 24 小时才能在商店显示。[Apple 手动发布步骤](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/)。

### 如果审核没有通过

1. 进入 App Review，阅读本次提交的 Messages 和具体拒绝原因。
2. 资料问题按要求补充说明或修改页面；代码问题先修复并在真机验证。
3. 修改安装包时递增构建号，重新同步、归档、上传，选择新构建。
4. 按审核页面的 Update Review、Resubmit 等操作重新提交。

保留原应用记录和 Bundle ID，针对拒绝原因处理。审核结果由 Apple 决定。

## 上架后发布更新

1. 修改代码并完成真机验证。
2. 在 `ios-app.json` 将版本改为高于已发布版本的值，例如从 `1.0.0` 改为 `1.0.1`，构建号继续递增。
3. 执行 `npm run ios:sync`，在 Xcode Archive 并上传。
4. 先将新构建加入 TestFlight 测试组，验证更新安装和偏好保留。
5. 在 App Store Connect 的应用中，通过 iOS 版本旁的加号创建 `1.0.1`。
6. 填写 What's New in This Version，检查继承的资料是否仍准确，选择对应的新构建。
7. 设置发布方式，Add for Review，再 Submit for Review。
8. 审核通过后按所选方式发布，用户通过 App Store 更新。

TestFlight 和 App Store 都沿用原来的应用记录。修改代码不会自动更新已经安装的 App；真机开发安装、TestFlight、App Store 各自按对应流程更新。

## 出现问题时查这里

| 现象或提示 | 先做什么 |
| --- | --- |
| 手机上还是旧页面 | 确认 `npm run ios:sync` 成功，再选真实手机 Run；不要只运行 `npm run dev` |
| Build Succeeded，但手机没有 App | 检查运行目标、设备准备进度和后续安装错误；编译成功还不是安装成功 |
| Replace “App”? | 点击 Replace，结束旧运行并启动新实例 |
| Signing requires a development team | 在 App target 的 Signing & Capabilities 选择 Team |
| Your team has no devices | 连接并解锁手机，完成配对和开发者模式，再选真实设备，点击 Try Again |
| Developer Mode disabled | 在手机开启开发者模式，完成重启后的再次确认 |
| Copying / Extracting OS library symbols | 保持连接、解锁，等待首次设备准备完成；先不要反复 Run |
| Developer App Certificate is not trusted | 在手机的“通用 / VPN 与设备管理”信任自己的开发者证书 |
| Bundle Identifier is not available | 核对所选团队与标识归属；必要时修改 `ios-app.json` 的 `appId` 并同步 |
| Build Failed | 按 `Command + 5` 查看第一条红色错误，先修复它 |
| Archive 灰色或没有生成归档 | 确认 Scheme 为 App，目标选择 Any iOS Device (arm64) |
| 上传提示构建号已用过 | 在 `ios-app.json` 递增构建号，重新同步、Archive 和上传 |
| 上传成功，但 TestFlight 暂时没显示 | 等待构建处理，查看 App Store Connect 状态和处理结果邮件 |
| Missing Compliance | 打开该构建的出口合规问题，按实际加密使用情况回答 |
| 内部构建无法选入正式版本 | 检查是否 Internal Only，版本号是否匹配，以及处理或合规是否完成 |
| 免费真机 App 过几天打不开 | 免费签名可能已到期，连接手机重新同步并 Run |
| TestFlight 提示构建过期 | 上传新的构建并加入测试组，再在手机 TestFlight 更新 |

需要记录错误时，保留完整提示、版本和构建号、所选设备及复现步骤。更完整的开发与验收记录见 [iOS 开发指南](../docs/ios-development.md)。
