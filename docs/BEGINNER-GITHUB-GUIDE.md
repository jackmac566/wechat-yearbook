# 零成本发布与更新教程（Mac 新手版）

目标：公开源码，并让 GitHub 自动生成 Apple 芯片 Mac、Intel Mac 和 Windows 安装包。公开仓库使用标准 GitHub 托管运行器通常无需付费；Apple/Windows 商业代码签名仍需费用，所以本项目先用“源码 + 自动构建 + SHA-256 + GitHub 构建证明”建立可验证链路。

## 先认清哪些文件绝对不能上传

可以上传源码、文档、测试和示例假数据。绝对不要上传：

- 真实聊天 JSON/CSV、微信支付账单、朋友圈导出
- 微信原始数据库、DbKey、登录信息、支付密码
- 手机号、邮箱验证码、证书私钥、GitHub Token

`.gitignore` 只能挡住常见名称，提交前仍要在 GitHub Desktop 的 Changes 列表逐项看一遍。

## 第一次发布源码

如果仓库已经由 Work Buddy 或 GitHub Desktop 发布成功，可以跳到“发布 V0.2.1 安装包”。

1. 用 GitHub Desktop 登录，选择 **File → Add Local Repository**，添加项目文件夹。
2. 如果提示还不是仓库，点 **create a repository**。Git Ignore 和 License 都选 None，因为项目已经包含。
3. Summary 填真实内容，例如 `Prepare v0.2.1 security and import fixes`。
4. 点 **Commit to main**，再点 **Publish repository** 或 **Push origin**。
5. 公开仓库应能看到 `README.md`、`CHANGELOG.md`、`LICENSE`、`.github/workflows/`、`src/` 和 `electron/`。

V0.2.0 起才有可由 GitHub Release/标签验证的发行记录。V0.1.x 只作为迁入 GitHub 前的原型记录保留，不要补造旧 Git 标签或提交。

## 一次性打开安全发布设置

在仓库网页完成：

1. **Settings → Actions → General → Workflow permissions**，选择 **Read and write permissions** 并保存。工作流自身仍按任务使用最小权限。
2. **Settings → General**，滚到 **Releases**，勾选 **Enable release immutability**。它只保护以后发布的版本；官方说明见 [Immutable releases](https://docs.github.com/code-security/concepts/supply-chain-security/immutable-releases)。
3. **Settings → Security → Code security and analysis**，打开 **Private vulnerability reporting**（如果页面提供）。这样安全问题可先私下报告，不必公开聊天数据或漏洞细节。
4. 确认仓库仍为 Public；GitHub Free 的构建来源证明用于公开仓库。

## 发布 V0.2.1 安装包

新版工作流会自己建立草稿、上传全部附件、再发布 Release。不要先在网页手动创建同名 Release，否则安全检查会拒绝覆盖。

### 1. 本地最后检查

在终端进入项目目录，然后运行：

```bash
npm ci
npm run check
npm audit --audit-level=high
```

三条都成功后，在 GitHub Desktop 提交全部 V0.2.1 改动并点 **Push origin**。先到 GitHub 网页确认最新提交已经出现。

### 2. 只创建并推送标签

仍在项目目录运行：

```bash
git switch main
git pull --ff-only
git tag -a v0.2.1 -m "微信年轮 V0.2.1"
git push origin v0.2.1
```

标签必须是全新的，且与 `package.json`、`src/version.js`、`CHANGELOG.md` 和 `docs/releases/v0.2.1.md` 一致。不要移动、覆盖或复用已经发布的标签。

### 3. 等自动构建

打开仓库 **Actions → Build desktop release**。应看到：

- Mac Apple 芯片 arm64：DMG + ZIP
- Mac Intel x64：DMG + ZIP
- Windows x64：EXE + ZIP
- 发布任务：`SHA256SUMS.txt`、GitHub Artifact Attestation、Release

全部变绿后，仓库 Releases 会自动出现 V0.2.1。工作流不会 `--clobber` 已有附件；如果意外留下同名草稿，应先确认它确实由本次失败运行创建，再删除草稿并重新运行，绝不要删除已经公开的正式 Release 来“重传”。

## 用户该下载哪个文件

| 电脑 | 文件名包含 | 推荐 |
|---|---|---|
| Apple 芯片 Mac（M1 及以后） | `mac-arm64` | `.dmg` |
| Intel Mac | `mac-x64` | `.dmg` |
| 64 位 Windows | `win-x64` | `.exe` 安装版或 `.zip` 便携版 |

Mac 左上角 **苹果图标 → 关于本机**：显示“芯片 Apple M…”选 arm64；显示“处理器 Intel”选 x64。

## 下载后先核对，再打开

下载对应安装包和 `SHA256SUMS.txt`。在 Mac 终端进入下载目录：

```bash
cd ~/Downloads
shasum -a 256 WeChat-Yearbook-0.2.1-mac-arm64.dmg
```

把输出与 `SHA256SUMS.txt` 中同名文件那一行比较，必须逐字相同。安装了 GitHub CLI 的用户还可验证构建来源：

```bash
gh attestation verify WeChat-Yearbook-0.2.1-mac-arm64.dmg -R 你的GitHub用户名/wechat-yearbook
```

GitHub 官方说明也强调：构建证明能确认文件从哪个源码与工作流产生，但不是“软件绝对安全”的保证；仍要审阅源码、权限和发布账号。

## 未付费签名应用怎么打开

Mac：

1. 打开 DMG，把“微信年轮”拖进 Applications。
2. 在 Applications 中按住 Control 点应用，选择 **打开**，再确认一次。
3. 若没有按钮，到 **系统设置 → 隐私与安全性**，在拦截提示旁点 **仍要打开**。
4. 不要关闭 SIP，也不需要执行 `xattr -cr`、重签微信或输入管理员密码给本应用。

Windows：SmartScreen 出现时先核对 Release、SHA-256 和构建证明，再点 **更多信息 → 仍要运行**。

## 以后每次更新都要重新发布吗？

是。源码改动不会自动替换用户电脑里的旧应用。每个公开更新都要：

1. 升级版本号，例如 `0.2.2`。
2. 只记录真正完成并通过测试的更新，准备 `docs/releases/v0.2.2.md`。
3. 提交并推送源码。
4. 创建全新标签 `v0.2.2` 并推送。
5. 等 Actions 生成全新的不可变 Release；用户重新下载安装。

当前版本没有静默自动更新器，避免应用在后台下载并替换可执行文件。更新检查以 GitHub Release 为准。

## 常见失败

- `Resource not accessible by integration`：检查 Workflow permissions 是否为 Read and write。
- `npm ci` 失败：`package.json` 和 `package-lock.json` 没同步，先在本地执行 `npm install`、测试、提交 lockfile。
- `Release already exists`：网页已经有同名 Release；不要覆盖正式版，改用更高版本号。若仅是本次失败留下的草稿，核实后删除草稿再重跑。
- Artifact attestation 无权限：仓库需公开，且发布任务需要 `id-token: write` 和 `attestations: write`；本项目工作流已声明。
- Mac 提示损坏或打不开：先确认架构与哈希；不要关闭 SIP。若 Actions 的 Mac 构建步骤失败，应先修构建，不要绕过系统保护。
