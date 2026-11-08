# 微信年轮 · 静态官网（site/）

本目录是「微信年轮」的静态官网：纯 HTML + CSS，**无构建步骤、无第三方脚本、无追踪、无外部字体**（仅系统字体栈）。双击任意 HTML 文件即可用 `file://` 直接浏览，也可部署到任意静态托管。

## 文件结构

| 文件 | 内容 |
| --- | --- |
| `index.html` | 首页：Hero、核心能力三块、使用三步、诚实说明区、下载区（SHA-256 与未签名指引）、页脚 |
| `guide.html` | 使用指南：聊天数据获取、支付账单获取、朋友圈说明、FAQ |
| `privacy.html` | 隐私说明：本地处理、两类导出、安全边界、开源与审计 |
| `changelog.html` | 更新日志：V0.5.2 至 V0.3.0，兼容范围与已知限制 |
| `assets/site.css` | 全站共享样式（桌面优先，响应式） |
| `downloads/` | DMG 放置目录，见下方「DMG 分发」 |
| `check-links.mjs` | 零依赖自检脚本 |

## 本地自检

```bash
node site/check-links.mjs
```

脚本会检查：

1. 所有页面的 `<a href>` 相对链接指向存在的文件（`downloads/` 目标为 expected-missing，待 DMG 放入后自动变为存在）；
2. HTML 标签闭合（简单栈式校验）；
3. 关键文案（SHA-256、未签名指引、「选中聊天」覆盖说明、已知限制等）；
4. 无外部资源（无 CDN / 字体 / 脚本）、无 `<script>` 标签、无夸大承诺用语。

## 部署

### GitHub Pages（发布 site/ 目录）

任选其一：

- 在仓库设置中把 Pages 来源指向 `gh-pages` 分支，把本目录内容推到该分支根目录；或
- 用 GitHub Actions 构建一个只包含 `site/` 内容的产物（例如 `actions/upload-pages-artifact`，路径填 `site/`），再用官方 `deploy-pages` 部署。

### DMG 分发

DMG 文件名固定为 `微信年轮-V0.5.2-Mac候选-arm64.dmg`，两种方式任选：

1. **上传 GitHub Releases**：把 DMG 作为 Release 资产上传，然后把 `index.html` 中两处下载链接改为对应 Release 资产地址（同时更新页面上的 SHA-256 与版本号）；或
2. **放入本目录**：直接把 DMG 放进 `site/downloads/`，与页面一起部署（注意 DMG 体积较大，谨慎选择托管配额）。

### 发布前更新清单

- `index.html` 的版本号、SHA-256、下载链接；
- `changelog.html` 的新版本条目；
- 若完成正式签名，删除/更新「临时签名」说明，并同步「仍要打开」指引。

## 当前部署（2026-11-08）

| 目标 | 地址 | 说明 |
| --- | --- | --- |
| Cloudflare Pages（主） | https://wechat-yearbook.pages.dev/ | wrangler 直传：`npx wrangler pages deploy site --project-name wechat-yearbook --commit-dirty=true` |
| GitHub Pages（镜像） | https://jackmac566.github.io/wechat-yearbook/ | Actions 自动部署（.github/workflows/pages.yml，推送到 main 且 site/** 变更时触发） |
| DMG 下载 | GitHub Releases v0.5.2 | https://github.com/jackmac566/wechat-yearbook/releases/tag/v0.5.2（Pages 单文件上限 25MB，DMG 必须放 Releases 或对象存储） |

更新站点时：改 site/** → `node site/check-links.mjs` 自检 → wrangler 直传 Cloudflare → git push 触发 GitHub Pages 镜像。
