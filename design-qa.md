# 官网设计与功能验收

final result: passed

日期：2026-10-27。实现地址：`http://localhost:4173/ja/`。本记录替代首轮把纸纹和水墨装饰简化视作可接受差异的结论；用户指出的缺失按P1修复。

## 视觉依据与修复

选定原稿：`docs/design-20261027-v02/previews/home-selected-v01.png`。本轮没有新增整页设计备选。

- [P1／已修复] 原版正文只有平面纸色。接入真实宣纸纹理，覆盖首页与资料、文章等内页。
- [P1／已修复] 头图下沿是直线切割。接入ImageGen飞白遮罩，保留官方头图题字，恢复不规则水墨与纸纤维收边。
- [P1／已修复] 首页两侧山水、朱叶与淡金云纹缺失。补入原生透明的独立装饰图层，并保留资讯左侧山松。
- [P2／已修复] 手机直接裁切装饰中央透明区会使边缘绘画再次消失。改为分别对齐左右边缘，降低透明度以保持正文清楚。

原稿与实现同图对比：`docs/qa/comparison-refined-final.jpg`。将1003×1568原稿等比归一到浏览器内容宽988，与同高实现区域并排，源图不含的首页后续内容不纳入比较。已实际查看最终组合。

桌面最终截图：`docs/qa/home-ja-refined-desktop-final.jpg`，988×4373；CSS视口1003×1568，滚动条占15px。手机最终截图：`docs/qa/home-ja-refined-mobile-final.jpg`，375×5707；CSS视口390×844。实际桌面／手机预览合图：`docs/qa/site-refinement-preview.jpg`。

字形仍采用系统明朝／宋体回退；原稿手写字形与响应式实时文字存在差异。纸纹、边缘水墨和头图飞白已恢复，不声称逐像素复刻。素材原作和提示词见`docs/视觉素材补充-20261027.md`。

## 本轮图鉴与交互

- 收录83位武将。每位符合基础武力、智力、德望至少一项90以上；技能简介、实际效果和天赋节点使用当前游戏数据及语言表。
- 装备／道具共84件：73件1—7级详情与图标，11件8级仅名称。用户明确不含8级；8级对象没有ID、等级、详情和图标路径，public中没有对应高阶图标。
- 总数独立于搜索结果；实际搜索7级传国玉玺可读详情，8级赤兔马只出现名称。手机证据：`docs/qa/equipment-names-only-mobile-final.jpg`。
- 曹操固有技能的简介及两项25%效果与用户截图一致；天赋3级奇正阵、5级黄巾、7级虎豹骑、9级振军按顺序显示。1级全未解锁，3级仅首节点可习得，9级四节点均可习得；切换只影响预览。
- 技能／天赋页签支持点击和左右方向键；习得内容可展开。中文、日文、英文已实际打开，切换语言保留人物路径；长英文名称在手机自然换行。
- 证据：`officer-cao-skill-zh-desktop-final.jpg`、`officer-cao-talents-zh-desktop.jpg`、`officer-cao-talents-zh-mobile-final.jpg`、`officer-cao-talents-en-mobile-final.jpg`，均在`docs/qa/`。
- 手机首页、武将页及装备页内容宽375，与CSS视口390减去15px滚动条一致，未出现横向溢出。菜单和语言切换可用。最终浏览器日志无错误或警告。

## 构建与公开边界

`pnpm run build:pages`成功，输出静态页面、留言Worker和语言404。公开数据与页面脚本分包，单个产物未超过Vite默认500kB提示线。`pnpm check`验证312个HTML与6464处站内链接／资源引用。

19项测试通过，涵盖精选武将资格与技能文本、8级信息边界、图标清单、三语稿件、留言来源检查、验证码先后顺序、私有字段剔除、代理IP、限流、Pages未配置状态及韩文404、模板兼容。

8项本地HTTP检查通过，见`docs/qa/refinement-http-verification.json`：三语页面200、韩文和未知路径404、`.env`不可读取、留言状态未配置。未提交外部留言。

## Cloudflare部署范围

已实现独立Pages适配与`build:pages`入口，说明见`docs/Cloudflare-Pages部署说明.md`。Worker在本地使用模拟静态绑定与环境变量验证；尚未创建Cloudflare项目或进行真实云端部署。留言业务接口和验证码服务未提供，真实联调仍待作者配置，不计作已连接。

游戏新增367「全谋」缺少语言表词条，网站提供独立三语校对稿；装备日英编辑稿仍待作者校对。原始人物装备、获取条件、事件和其他隐藏信息继续保留。

本轮无未处理的P0／P1／P2。首次浏览器复核因额度窗口暂停，窗口恢复后已继续完成桌面、手机和三语检查；没有绕过审批或改用另一浏览器。

## 2026-10-27追加：Logo、页尾和子页面顶部

- [P1／已修复] Logo滤镜将原始木色和纹理压成白色。切换原始彩色透明PNG并移除滤镜；源文件与官网文件SHA-256一致。导出器同步修正，避免下次导出恢复错误。
- [P2／已修复] 页尾过于单调。两侧添加首页同套山水枝叶、朱叶和淡金云纹，中心文字与链接保持清楚。
- [P2／已修复] 子页面顶部与页头衔接空白。新增攻略、图鉴、开发日志、开发者专栏、留言5组主题插画；详情页继承父板块，隐私与404复用对应图层。
- 桌面1440×900、手机390×844分别查看了5个板块；手机内容宽375，没有横向溢出。实际打开攻略正文确认继承攻略插画，Logo在手机宽260px且滤镜为none。浏览器无error／warn。
- 桌面各板块证据为`docs/qa/header-{guides|data|devlog|creators|guestbook}-desktop.jpg`，手机版为对应`-mobile.jpg`；总览`docs/qa/section-headers-overview.jpg`。Logo与页尾证据`docs/qa/logo-footer-desktop-final.jpg`，手机完整页面为`docs/qa/home-logo-footer-mobile-full.jpg`。
- Pages构建成功；312个HTML及6464处内部链接／资源引用检查通过。额外逐页确认所有非首页HTML拥有有效主题类，统计见`docs/qa/section-header-route-coverage.json`。

本轮复用既有页尾素材，并使用内置ImageGen绘制5组子页顶部图。没有生成新的首页备选；没有外网发布。

## 2026-10-27追加：页脚木质窗棂

- [P2／已修复] 页脚分界偏弱。上边界下方追加28px暖棕木质镂空窗棂横纹，保持原有宣纸与水墨枝叶。独立装饰层aria-hidden，不遮挡点击。
- 实际查看中文首页和攻略页的共用页脚。桌面1440×900时内容宽1425，边饰与文字相距16px；手机390×844时内容宽375，间距20px，未出现横向溢出。浏览器error／warn为空。
- 页面证据：docs/qa/footer-lattice-desktop.jpg、footer-lattice-mobile.jpg、footer-lattice-guides-desktop.jpg。测量记录：docs/qa/footer-lattice-browser-qa.json。
- Pages重新构建通过；312个页面及6464处内部链接／资源引用检查通过。源素材为内置ImageGen生成，原作与完整提示词记录在docs/footer-lattice-asset.json。

## 2026-10-27追加：图鉴纹饰与武将档案

- [P2／已修复] 武将／装备栏位单调。复用宣纸、山水旌旗与剑甲插画，低透明度铺在栏位角落，文字和原始头像保持清楚。
- [P2／已修复] 武将缺少体力、胆识。83位公开武将新增基础max_hp与cou，列表及详情均显示，六项属性用金线分区和细刻度呈现。曹操80／86与当前游戏基础字段相符；未使用场景hp。
- [P2／已修复] 详情空散。改为纸本人物档案结构，头像／简介／六项能力集中在上方，技能与成长单独成区；技能效果分栏、天赋纵向连线。键盘左右键仍能切换页签，9级预览正确显示曹操四个可习得节点。
- [P2／已修复] 装备0值冗余。实际搜索短剑仅显示攻击4、重量2；传国玉玺不生成空属性栏，德望+10附加效果仍存在。
- 桌面1440×1000／1200、手机390×844检查了图鉴与中英详情，并查看日文列表。英文诸葛亮长姓名和长技能正常换行。额外在320×844查看英文列表与天赋；内容宽305，属性文字未超出栏位。常规手机内容宽375，无横向溢出，浏览器error／warn为空。首页共用卡片也显示新增属性。
- 自动检查：4项公开数据回归通过；249个三语武将详情页均有正确的六项属性；36个静态装备卡片的属性与非零源值逐项一致。Pages构建成功，312个文档与6464处内部资源／链接检查通过。未重跑无关后端测试。
- 证据在docs/qa/：officer-dossier-zh-desktop-final.jpg、officer-dossier-zh-mobile.jpg、officer-dossier-en-mobile.jpg、officer-talents-en-mobile.jpg、officer-cards-zh-desktop.jpg、officer-cards-ja-mobile.jpg、officer-cards-en-320-mobile.jpg、equipment-cards-zh-desktop.jpg、equipment-zero-stats-zh-mobile.jpg。统计记录为codex-cards-static-qa.json、codex-cards-browser-qa.json。

无未处理的本轮P0／P1／P2。继续保留83位精选规则和8级以上仅名称的公开边界；没有外网发布。

## 2026-10-27追加：紧凑天赋、武将切换与元信息

- [P2／已修复] 天赋描述框过高。1440×900桌面实测：节点框112.125／81.938px变为统一44px，四节点总高472.125px变为211px，减少55.3%；天赋面板639.469px变为358.344px。名称与描述同排，收起的习得内容入口位于右侧。日文同样为44px。
- 390px中文手机与320px英文手机检查通过，内容宽分别为375、305，无横向溢出；长文字自然增高。中文9级预览四个节点可习得；展开首节点后框高98.891px，完整内容可读，没有固定高度裁切。
- 顶部快捷切换实际点击曹操→孙坚→曹操→刘备，首位上一位禁用；英文末位下一位禁用，前一位路径为433而非459，确认沿公开图鉴顺序。三语249个详情的492条相邻链接全部验证。
- 312个HTML均包含指定的8个关键词和4个图标引用。ICO与原作校验一致；PNG分别为32／128px，触屏图标180px。浏览器error／warn为空。
- Pages构建成功；312个HTML和8204处内部链接／资源引用检查通过。当前发布目录498个文件，最大文件3323515字节。未执行真实Cloudflare发布。
- 证据在docs/qa/：talents-compact-zh-desktop.jpg、talents-compact-zh-mobile.jpg、talents-compact-ja-desktop.jpg、talents-compact-en-320-mobile.jpg、officer-navigation-first-desktop.jpg、officer-navigation-last-en-mobile.jpg、officer-navigation-zh-desktop.jpg。统计与测量见talents-navigation-meta-static-qa.json、talents-navigation-browser-qa.json。

## 2026-10-27追加：Workers部署与安装兼容

- 已修复云端pnpm 9.10.0读取缺少packages的工作区文件时停止安装的问题；加入根包并固定pnpm 11.25.0、Node 24，在线冻结安装通过。
- 新增wrangler.jsonc与build:workers，静态目录./dist/client，复用原边缘处理器。Wrangler 4.153.0 dry-run打包成功，ASSETS绑定有效；没有调用真实部署。
- Pages构建和Workers构建均通过；19项既有回归通过。Workers本地运行时15项HTTP检查全部通过，记录docs/qa/workers-local-http-qa.json；312个文档与8204处站内链接／资源检查通过。
- README现有冲突的两侧内容均保留，整理为官网维护说明和游戏介绍，移除冲突标记。没有提交或推送到远程。

## 2026-10-27追加：中文优先与自动语言入口

- 导航统一中文、日文、英文、韩文；根路径、无JS内容与通用404默认中文。日文／英文显式地址、分享的攻略和武将链接保持原语言。
- 根入口按手动偏好、浏览器语言、中文默认的顺序选择；中文地区变体归一zh-cn。只记住手动选择，韩文入口不覆盖偏好；localStorage被禁用时仍可访问。自动跳转保留参数与锚点，replace避免返回键循环。
- 根入口仅先加载约2.92kB的入口脚本，确定语言后再加载页面应用。首屏CSS仍置于静态head，保留原设计与无JS阅读。
- 浏览器实际验证：日文、英文手动选择后回到根路径仍保持选择；参数与main锚点保留；英文偏好下可直达日文攻略；手机菜单切到同一篇中文攻略，武将切换到同一位英文武将；韩文准备页后根入口仍为中文。1440×900桌面与390×844手机正常，手机内容宽375，无横向溢出；error／warn为空。
- Pages兼容构建、Workers最终构建和27项回归通过（含8项语言边界测试）；312个HTML的语言菜单、首屏样式及7580处内部资源检查通过。用作者给定SITE_URL构建，根canonical为https://www.3kranse.com/zh-cn/，303条站点地图地址有效。没有修改云端变量、推送或执行发布。
- 证据在docs/qa/：language-home-desktop.jpg、language-order-desktop.jpg、language-order-mobile.jpg、language-browser-qa.json、language-static-qa.json。

## 2026-10-27追加：D1 REST留言与Turnstile

- 默认留言数据源改为服务端D1 REST /raw，兼容现有messages五列。IF NOT EXISTS创建message_metadata与IP／时间索引，保存浏览器白名单和幂等信息，不更改原表；成功投稿直接公开，公开API不返回私有IP字段和浏览器信息。
- Turnstile公钥使用作者给定值，私钥与D1令牌仅由运行时Secret读取。服务端验证success、当前hostname与guestbook action。只有D1配置时可阅读，验证码配置未齐时禁止投稿。keep_vars保留控制台设置；集中维护CSP，仅增加官方脚本与frame来源。
- 36项回归通过，含9项内存SQLite实际SQL集成测试：参数化写入、可信IP、私有字段过滤、数字游标分页、验证失败无留言、幂等重放、跨实例每IP5条限额、元数据失败回滚、上游错误不泄密。发现并修复CAST字符串别名影响数字ID排序的问题。
- Pages兼容构建与最终Workers构建通过；Wrangler dry-run打包通过。312个HTML／7580处链接和资源检查通过；浏览器输出未出现D1_API_TOKEN、TURNSTILE_SECRET_KEY、cfat令牌或D1管理API地址。真实本地workerd的8项HTTP检查通过，缺少机密时投稿503，状态不含私密值；韩文和服务器私有文件404。
- 桌面1440px、390px手机与320px英文窄屏检查通过，手机内容宽375／305，无横向溢出。验证码不足300px时使用compact；失败提示和重新验证入口可用，投稿按钮禁用。真实加载了Cloudflare官方“总失败”测试公钥，600010为预期测试结果；未点击解决验证码或提交留言。修正官方组件语言参数为小写zh-cn，去除自动重复重试。
- 线上只读D1检查因当前环境连接不可用未完成；没有线上写入或发布。生产域名／真实私钥／D1权限仍需作者在控制台配置后完成一次实际投稿。没有持久化作者粘贴的私密值。
- 证据：docs/qa/d1-turnstile-failure-mobile.jpg、d1-turnstile-en-320.jpg、d1-guestbook-preparing-desktop.jpg、d1-browser-qa.json、d1-workers-http-qa.json、d1-static-qa.json、d1-live-readonly.json。当前配置与操作说明在docs/D1留言与Turnstile配置.md。
