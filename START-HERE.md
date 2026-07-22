# 新手第一步：发布或更新微信年轮

当前源码版本是 V0.2.1。最省事的路线是：**本地检查 → GitHub Desktop 提交并推送 → 终端推送新标签 → GitHub Actions 自动生成 Release**。

## 如果仓库已经发布成功

不要重新建仓库，也不要手动覆盖 V0.2.0。先阅读 [零成本发布与更新教程](docs/BEGINNER-GITHUB-GUIDE.md)，按其中“发布 V0.2.1 安装包”操作。

发布前必须确认：

- 项目里没有真实聊天、账单、数据库、密钥或验证码。
- `npm run check` 与 `npm audit --audit-level=high` 都成功。
- GitHub 上最新源码提交已经出现。
- **不要先手动创建 V0.2.1 Release**；只推送 `v0.2.1` 标签，让安全工作流先建草稿、上传附件再发布。

## 如果是第一次建仓库

1. 用 GitHub Desktop 添加项目目录并创建仓库。
2. Summary 填真实改动，Commit 后 Publish repository，取消 Keep this code private。
3. 在 GitHub Settings 打开 Actions 的 Read and write permissions、未来 Release immutability 和 Private vulnerability reporting。
4. 再按教程创建 `v0.2.1` 标签。

V0.2.0 起才是可验证的 GitHub 发行记录；V0.1.x 是迁入 GitHub 前的产品原型记录，不要补造旧标签。
