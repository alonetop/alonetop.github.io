# 随记 / Notes, quietly.

一座可以部署在 GitHub Pages 的双语数字花园。Astro 静态生成、Markdown 写作、原创 WebGL 颗粒流场、深浅主题、Pagefind 双语全文搜索、标签归档和 RSS，无需后端。

## 本地开发

使用 Node.js 24（项目提供 `.nvmrc`）。

```sh
npm ci
npm run dev
```

开发地址以终端输出为准。全文搜索依赖构建后的索引，请用生产预览检验：

```sh
npm run check
npm run build
npm run verify
npm run preview
```

默认构建站点地址为 `https://example.com`，仅用于开发。正式部署使用 Pages 工作流自动注入的真实地址。

## 修改个人资料

编辑 `src/lib/site.ts` 中的 `profile`：

- `name`、`tagline`、`bio`、`about` 分别维护 `zh` 和 `en` 两个版本。
- `social` 中填写 GitHub 完整链接、邮箱或 Mastodon 链接；空值自动隐藏。
- `projects` 中填写项目介绍与链接；项目当前为示例，编辑关于页时可移除示例标记。
- 页面的导航及提示文案位于同文件的 `labels` 字典。
- 视觉样式位于 `src/styles/global.css`；原创背景着色器位于 `src/scripts/flow.ts`。
- 替换 `public/favicon.svg` 和分享图 `public/images/share.svg` 可继续完善个人品牌。部分社交平台需要 PNG/JPG 分享图，可自行替换并更新 Base 布局中的路径。

首版六篇文章及中英译文均为原创排版示例，`demo: true` 会显示示例说明。请用自己的内容替换，再将其设为 `false`。尚未提供真实资料，所以不会虚构履历或联系方式。

## 添加文章

在 `src/content/posts/zh/` 或 `src/content/posts/en/` 下新建 `.md` 文件，文件名决定文章地址，例如 `my-first-note.md` 对应 `/zh/posts/my-first-note/`。

```yaml
---
title: "我的第一篇文章"
description: "一段简短摘要。"
date: "2026-10-24"
lang: "zh"
tags: ["技术", "随笔"]
translationKey: "my-first-note"
featured: false
draft: false
demo: false
---
## 从这里开始

正文支持 Markdown、代码高亮、表格、引用和图片。
```

- 中英译文使用相同 `translationKey`，但标题、摘要、标签和正文分别翻译。
- `lang` 必须与目录一致。只发布一种语言也可以，语言切换在无译文时进入另一语言的归档。
- 同一语言中 `translationKey` 应唯一；文件名建议使用英文短横线格式。
- `draft: true` 的文章不会出现在页面、搜索、RSS 或站点地图中。
- 首页显示最近两篇 `featured: true` 的文章，以及最新五篇文章。
- 日期按 UTC 格式化，避免不同构建时区导致日期改变。
- Markdown 图片建议放在 `src/assets/`，在文章中用相对文件路径引用，例如 `![描述](../../../assets/name.svg)`。Astro 会自动处理输出路径，兼容仓库子路径。嵌套文章目录时，请相应调整相对文件路径。
- 文章中的站内链接也应考虑部署基础路径；同级文章可使用 `../another-note/`。

## GitHub Pages 部署

1. 将项目上传到自己的 GitHub 仓库，主分支使用 `main`。
2. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 推送到 `main`，或在 Actions 页面手动运行 **Deploy journal to GitHub Pages**。
4. 等待 build 和 deploy 均成功，访问部署步骤给出的地址。

工作流使用 Pages 返回的 `origin` 和 `base_path`，同时支持 `username.github.io` 根站点和 `username.github.io/repository/` 项目站点。不要把 `dist/` 或 `node_modules/` 提交进仓库。没有配置仓库前，本项目只在本地预览，不会自行创建仓库或发布。

如果使用其他分支，请修改 `.github/workflows/deploy.yml` 的 `branches`。

### 模拟子路径

```sh
SITE_URL=https://example.com BASE_PATH=/journal/ npm run build
SITE_URL=https://example.com BASE_PATH=/journal/ npm run verify
BASE_PATH=/journal/ npm run preview
```

预览访问 `/journal/zh/`。切回根路径时重新执行 `npm run build` 和 `npm run preview`。

### 自定义域名

先在 GitHub Pages 配置域名与 DNS，按 GitHub 提示添加 `public/CNAME`。工作流读取 Pages 元数据；确认最终 `SITE_URL` 为真实域名、`BASE_PATH` 为 `/`。RSS、canonical、站点地图均在构建时生成，因此更换域名后需要重新部署。

## 交互与无障碍

- 搜索按钮或 `⌘ K` / `Ctrl K` 打开搜索，方向键选择、回车打开、Esc 关闭。
- 主题选择保存在浏览器本地，无已保存偏好时默认黑底白字，浅色模式同样仅使用黑白灰。
- 全站背景自动播放。首页滚动后背景会减弱，内页颗粒集中于边缘；切到其他标签页时停止绘制。
- 遵循系统减少动态效果设置，WebGL 不可用时展示 CSS 静态纹理。
- 禁用 JavaScript 后，页面正文、标签、目录、语言导航和 RSS 仍可访问，搜索与复制按钮属于增强功能。
- 搜索只索引文章，不索引导航与示例提示；中英文按页面语言分别搜索。

字体优先使用在线 DM Sans 和 Instrument Serif，网络不可达时自动回退系统字体；中文正文使用系统宋体风格字体，无强制外部字体依赖。

## 黑白开场与全站动效

- 每个页面通过公共布局渲染一个全屏画布；首页首屏颗粒较鲜明，文章、归档、标签、关于和 404 使用低密度边缘流场。
- 首次直接进入、刷新、新标签页打开时显示完整加载开场。姓名逐字显现，进度线按页面与字体初始化阶段推进，遮罩向上退出后触发文字入场。
- 站内点击、语言切换及前进后退采用短版入场，页面仍是独立 HTML，没有客户端路由依赖。
- 加载开场约 1 秒、退出约 0.4 秒。独立的内联保护在 2.2 秒内解除遮罩和滚动锁定；不等待全部图片或搜索索引。
- 中文标题按字、英文标题按完整单词编排，保留原有标题语义、换行和读屏名称。
- 系统开启减少动态效果时跳过开场，直接显示静态背景与文字；禁用脚本时不会出现加载遮罩。
- 公共开场逻辑位于 `src/scripts/bootstrap.js` 和 `src/scripts/intro.ts`，背景逻辑位于 `src/scripts/flow.ts`。`LoadingScreen.astro` 与 `AmbientBackground.astro` 为公共视觉组件。
- 导航标记与流场阶段使用会话存储。存储不可用时不影响阅读和导航。

## 本地内容客户端 · 随记工作台

已配套制作 macOS 客户端「随记工作台」。直接双击桌面上的 `随记工作台.app`，默认打开这个网站文件夹。支持：

- 文章搜索、语言筛选、草稿和精选管理；Markdown 编辑、阅读预览、图片插入。
- 修改中英双语姓名、首页简介、关于我、联系方式与个人项目；资料保存在 `src/lib/profile.json`。
- `⌘ S` 保存本地文件，未保存的输入会在客户端本机暂存，重新打开可恢复。
- 检查后创建提交并推送 GitHub，随后由现有 GitHub Actions 部署 Pages。

网站没完成时，可以只保存本地和预览，无需配置仓库。

第一次发布前，在客户端「发布设置」填写仓库地址、Git 提交姓名和邮箱。先在 GitHub 创建空仓库，并将 **Settings → Pages → Source** 设置为 **GitHub Actions**。本机 Git 需已配置 GitHub 登录或 SSH 密钥。客户端不存储 GitHub Token；设置保存在 macOS 用户应用数据目录，不写入网站源码。

「提交与发布」会依次运行 `check`、`build`、`verify`。首次发布初始化 `main`；后续发布先检查远端历史，远端领先或暂存区已有内容时停止。不会自动合并、重置或强制推送。网络或登录失败时，本地提交会保留，可修复后重试。**推送成功不等于云端部署成功**，请通过客户端「查看云端部署」确认 Actions 最终结果。

自动提交范围是 `src/`、`public/`、`.github/workflows/deploy.yml`、网站构建配置、`scripts/` 和 README。客户端源码、安装包、本机配置及依赖不会自动提交。注意：`draft: true` 仅从生成的网站页面、RSS 和搜索中排除，草稿的 Markdown 正文仍在仓库里；公开仓库中的草稿文件也可被读取。

### 客户端开发与重新打包

```sh
cd studio
npm ci
npm start
npm test
npm run package
```

运行测试的 Markdown 和 Git 仓库在系统临时目录中生成，不连接真实 GitHub。桌面界面冒烟验证：

```sh
npx electron test/ui-smoke.cjs
```

客户端使用 Electron 的隔离预加载桥接与沙箱，编辑界面不直接访问 Node；Markdown 阅读预览经过 HTML 清理。打包输出在 `studio/release/`，支持本机架构的 macOS。客户端运行与发布检查仍需本机的 Node.js、npm、Git，以及网站的已安装依赖。
