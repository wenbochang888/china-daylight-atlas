# 地图数据来源核验记录

核验日期：2026-10-02（北京时间）。已完成数据路线选择：采用天地图官方公开行政区网页自身的免账号／免Key响应，保存固定快照。早期候选研究保留在下文，其访问困难或缺口不适用于最终直接取得的官方响应。

## 最终采用结果

官方目录与全部几何已取得，3253节点缺失为0；34省、333市级、2883县级／对应层级和3辅助区域分别表达。所有原始多部件几何、境界线和属性保留，海岛注记有独立官方出处。源页面标示2025年9月局部更新，取得日2026-10-02不冒称数据更新日。

具体来源、层级、解码方法、海岛坐标与处理记录见 [provenance.md](../data/provenance.md)，逐省覆盖见 [coverage.md](../data/coverage.md)，成图与运行验证见 [validation.md](../validation.md)。不采用下述第三方候选的运行时数据。

## 1. 官方基准

- [自然资源部标准地图服务](https://bzdt.ch.mnr.gov.cn/)：作为标准图参照入口。网页读取超时；本次命令行读取返回 CloudWAF 拦截页，未取得实际标准地图文件。
- [天地图行政区划下载入口](https://cloudcenter.tianditu.gov.cn/administrativeDivision)：已取得官方网页 HTML 外壳。浏览器页面读取超时，尚未完成下载流程验证，不将“可打开外壳”视为无需登录下载成功。
- [全国地理信息资源目录的数据下载页](https://www.webmap.cn/commres.do?method=dataDownload)：检索内容说明下载服务已迁移至天地图平台。
- [国家基础地理信息中心公众版数据说明](https://www.webmap.cn/commres.do?method=result25W)：检索页面主体介绍 1:100 万公众版数据（2021），覆盖主要岛屿，整体数据年代为 2019；URL 与部分尾部内容存在混杂，不能仅凭页面标题确定实际下载文件版本。本次另一个 result100W 页面读取失败。
- [自然资源部《公开地图内容表示规范》原文，外交部网站存档](https://www.fmprc.gov.cn/web/wjb_673085/zzjg_673183/bjhysws_674671/bhflfg/dtdmxgfl/202303/P020230313585504979937.pdf)：已读全文相关条款，作为版图表达核验资料。以最终实施时核实的有效官方要求和标准图为准。

已从原文确认的核验方向：国界和县级以上行政区域按官方标准画法；全国图包含重要岛屿；南海附图有范围和名称规则；台湾省按省级行政单位表达。不能根据第三方示例自行猜测线段或岛屿标注。

## 2. 阿里云 DataV：可访问，但不是完整可直接采用的答案

- [官方范围选择器说明](https://help.aliyun.com/zh/datav/datav-6-0/user-guide/introduction-to-range-selector-features)明示数据来源为高德开放平台，支持县级下钻与本地下载。
- 实际下载了公开的全国样本：https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json 。无需提供账号和 Key，本次可成功获取。
- 样本有 35 个 feature：34 个省级条目，另有一个名为空、adcode 为 100000_JD 的辅助要素。辅助要素不能被计为第 35 个省。
- 台湾省条目 childrenNum 为 0；香港为 18、澳门为 8。这只是样本中的元数据，不代表官方行政层级已核验。
- 未逐级下载全部区域；不得推断该来源覆盖全国所有市县。也不能仅根据 GeoJSON 格式假定实际坐标系。
- 结论：可作为交互数据候选／比对来源，不能直接证明满足用户最重要的政府标准和完整性要求。

## 3. GeoJSON.CN：数据分级有访问条件

- [天地图派生数据集的提供方说明](https://geojson.cn/data/atlas/tiandi)称数据源为天地图，进行了拆分和转换，标注 CGCS2000。
- 同一页面明确全国／省级数据免费，市县数据有付费授权条件，不能承诺整套免费免注册。
- 本次访问其公开 _meta.json 目录返回 NoSuchKey XML，没有取得目录数据。
- [提供方的原始文件说明](https://geojson.cn/data/file/Tiandi_China)列有来源和数据日期，但页面上的审图号不能直接当作我们最终网页的审图号。
- 结论：仅作来源线索；不购买、不绕过授权，也不把公开目录说明当作已经取得数据。

## 4. GitHub 候选：明确存在加工与缺失

- [chinese-global-compliant-geodata](https://github.com/JayMuShui/chinese-global-compliant-geodata)自述中国数据来自天地图，台湾补充数据来自 GeoJSON.CN。
- [中国数据目录说明](https://github.com/JayMuShui/chinese-global-compliant-geodata/blob/main/src/geojson/countries/as/chn/global/README.md)写明数据版本为 2024 年 5 月，并列出作者进行的属性与层级修改。
- 作者写明“绝大部分县级”而非全部，并说明台湾三级细分和澳门细分存在缺失。不能据仓库名称或自述认定完整。
- 仅阅读了来源文档，未将整套数据导入项目。需要核实原始出处、处理差异、许可和实际几何后才能作采用决策。

## 5. 研究早期结论（已由上述官方直接响应路线解决）

当时技术路线可行，但尚未证实一个同时满足“无需注册／Key、全国目标层级完整、中国政府标准一致”的现成数据包。后续对公开客户端响应解码，取得了完整官方目录与原始几何，数据阶段已通过。

不能把暂未找到解释成不存在；也不能把“能下载”解释成“已准确”。下一轮应先确认用户对官方数据公开转载／转换版本的接受范围，然后针对该路线做完整性、版图及来源审查。

数据验收必须先于应用编码。不得为赶进度手绘缺失行政边界，或把缺失的地区默默隐藏。

## 6. 天文与渲染参考

- [USNO 日出日落和晨昏定义](https://aa.usno.navy.mil/faq/RST_defs)：常规日出日落阈值与民用晨昏定义，及地形／大气造成的观测差异。
- [Astronomy Engine 项目](https://github.com/cosinekitty/astronomy)：浏览器天文计算候选。
- [SunCalc 项目](https://github.com/mourner/suncalc)：另一个候选；当前文档提醒大版本之间单位和角度约定有变化，不能照旧示例混用。
- [Leaflet.Terminator](https://github.com/joergdietrich/Leaflet.Terminator)：昼夜边界交互参考，其模型不应直接等同于包含标准折射与晨昏定义的完整方案。
- [MapLibre GeoJSON 性能说明](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)：数据分块和简化的设计参考。
- [timeanddate 昼夜地图](https://www.timeanddate.com/worldclock/sunearth.html)：产品交互参考，不复制其地图数据或界面资产。
