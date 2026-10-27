# 3kranse · 《三国：乱世苍生》游戏官网

木头铅笔 / Wood Pencil Studio。美术：木头；程序：铅笔。

本地工程位于 `D:/JWorkspacePrivate/3kranse`。默认日文，提供中文和英文；韩文入口为404准备页。支持手机与桌面浏览。

- 日文：<http://localhost:4173/ja/>
- 中文：<http://localhost:4173/zh-cn/>
- 英文：<http://localhost:4173/en/>

已包括首页、三语Markdown攻略、精选武将与装备图鉴、操作说明、开发日志与规划、开发者专栏和玩家留言入口。Steam商店页及QQ群暂留准备状态。

## 后续使用

运行根目录`启动预览.ps1`可启动已构建的网站；传入`-Rebuild`会先重建。启动器优先使用本机Codex附带的新版本Node，避免电脑默认旧版本造成构建错误。已占用4173端口时不要重复启动同一个预览。

Markdown位于`content/`，目前共有27篇三语校对稿，其中入门攻略18篇。数值和措辞由作者后续校对；校对后更新frontmatter中的`editorialReview`与日期。

精选图鉴：83位基础武力、智力或德望达到90的武将；84件装备／道具，其中73件1—7级物品展示详情与图标，11件8级物品仅公开名称，公开资源中不携带它们的细节或图标。

## 文档

- [Cloudflare Pages部署说明](docs/Cloudflare-Pages部署说明.md)
- [网站维护说明](docs/网站维护说明.md)
- [玩家留言接口约定](docs/玩家留言接口约定.md)
- [本轮资料依据](docs/开发资料依据-20261027.md)
- [设计与功能验收](design-qa.md)
- [精选图鉴快照](docs/catalogue-export.json)
- 既有设计和视频分析保存在`docs/design-20261027-v02/`。

留言后端和验证码服务尚未提供。配置方法见`.env.example`与接口约定；token仅存服务端。当前表单显示准备中，不会假装提交成功。

## 开发命令

需要Node.js22+与pnpm；依赖以`pnpm-lock.yaml`为准。

```powershell
pnpm install
pnpm dev
pnpm build
pnpm check
pnpm test
pnpm start
```

`pnpm build`输出预渲染页面到`dist/client`；正式预览通过Node服务器运行，默认4173端口。发布前填写`SITE_URL`并重建以生成正式域名的SEO链接。尚未进行外网部署。

Cloudflare Pages使用 `pnpm run build:pages`，输出目录为 `dist/client`，已包含留言Worker与语言404适配。技能详情和天赋树已接入83位精选武将，支持等级预览。纸纹、边缘水墨和头图飞白素材记录见 `docs/视觉素材补充-20261027.md`。
