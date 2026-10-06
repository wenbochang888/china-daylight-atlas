# 四项观测体验改进验证 · 2026-10-06

本轮实施精选场景、关键时刻定位、代表点两日摘要与网页分享。用户要求仅做针对性检查；没有完整回归、性能测试、真机验证、iOS打包上传、Git提交推送或服务器部署。

## 实际实现

- 普通地图新增晨光、冬夏对比、此刻三个入口，保留省份选区、准备完整场景后一次性应用并暂停。晨光取完整全国几何上午最长慢速区间中点；冬夏日期由当前年节气计算；此刻采用点击时北京时间。旧节气入口继续自动播放。
- 顶部时钟打开时分弹窗，确认才更新地图；严格校验24:00，取消保持原时刻与暂停。地区详情可查看任一天代表点日出／日落，双图共用目标分钟，手机关闭详情返回地图。
- App共用选区与日期对应的太阳事件，摘要使用明细整数分钟之差；日出日落缺事件时保留不可比较说明，播放分钟变化不重算整日摘要。
- 网页分享快照提供复制链接与说明、失败时手动复制。启动解析版本化URL片段，地图创建前还原；处理后清除片段，普通刷新回今天零点。未知省份只丢弃地区，非法或过期日期整体拒绝。iPhone分支隐藏分享入口。
- 处理同页场景片段导航：暂停并重新加载，通过统一启动解析还原，防止后续普通刷新又读取未消费的片段。分享省份在地图目录成功读取时只核验一次。

## 检查与范围

| 检查 | 本轮结果 |
| --- | --- |
| `npm run typecheck` / `npm run build` | 通过；构建仍有原内置全国几何资源大于1300kB的分块提示 |
| `npm run test:unit -- tests/unit/observation.test.ts` | 1个文件、28项通过：上午区间、时分边界、摘要口径、缺事件、链接往返与非法／过期处理 |
| 新增专项E2E | desktop-chromium与mobile-chromium共6项通过，仅执行 `tests/e2e/observation.spec.ts` |
| `node scripts/observation-check.mjs` | 生产 `/atlas/` 子目录的1440×1000与360×800两场景通过，纽约设备时区；无页面异常及HTTP错误 |
| 视觉抽查 | 实际查看桌面与手机分享弹窗、场景布局及摘要截图；使用原主题、字体、44px操作区和底部时间轴 |

E2E覆盖三个场景、快速连续选择以最后一次为准、定位后暂停、24:01拒绝／24:00有效、Enter和Escape、焦点恢复、双图日期2日出定位、省份与摘要还原、剪贴板失败及成功提示、链接消费后刷新归零、非法／过期／未知省份。剪贴板成功和拒绝由浏览器测试替身控制；不等同于所有设备剪贴板权限的人工验证。

首轮6项中2项通过、4项失败，问题是同页片段导航不会触发启动解析，导致链接片段未消费和旧错误提示留存。补充同页导航处理后重跑专项，6项全部通过；最终记录只按修复后结果计数。

命令：

```sh
npm run test:unit -- tests/unit/observation.test.ts
npm run test:e2e -- tests/e2e/observation.spec.ts --project=desktop-chromium --project=mobile-chromium --output=/tmp/daylight-observation-e2e-final
npm run build
node scripts/observation-check.mjs
```

截图与生产JSON本机保存在 `docs/validation-images/observation-explore/`，按仓库规则忽略，不新增Git截图资产。浏览器trace输出在 `/tmp/daylight-observation-e2e-final`，不是长期证据。Markdown结论保留在仓库。

## 未验证部分

没有全量旧交互回归、WebKit专项、性能或内存测量、真机音频与剪贴板、iOS原生运行或TestFlight更新，也未检查线上部署。前三项功能复用Vue实现，不能据网页检查声称iPhone真机验收完成。
