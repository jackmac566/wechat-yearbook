# 零成本发布教程（Mac 新手版）

目标：把源码公开在 GitHub，并让 GitHub 自动替你生成 Apple 芯片 Mac、Intel Mac 和 Windows 安装包。按照 [GitHub 官方计费说明](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions)，公开仓库使用标准 GitHub 托管运行器免费；代码签名和自定义域名先不买。

## 先认清你要上传的文件

解压源码包后，项目根目录应看到：

- `README.md`：访客进入仓库第一眼看到的介绍
- `CHANGELOG.md`：公开版本记录
- `LICENSE`：允许他人使用和修改的 MIT 许可证
- `package.json`：版本号与构建配置
- `.github/workflows/`：自动测试和打包流程
- `src/`、`electron/`：应用源码

不能上传：真实聊天 JSON/CSV、微信支付账单、微信数据库、密钥、手机号、邮箱验证码。`.gitignore` 已经拦截一些常见名称，但仍要自己检查一次。

## A. 用 GitHub Desktop 发布源码

1. 安装 [GitHub Desktop](https://desktop.github.com/) 并登录。
2. 菜单选择 **File → Add Local Repository**。
3. 选择解压后的 `wechat-yearbook` 文件夹。
4. 看到“This directory does not appear to be a Git repository”后，点 **create a repository**。
5. Name 填 `wechat-yearbook`；Git Ignore 与 License 都选 None，因为项目已经包含这两个文件。
6. 点 **Create Repository**。
7. 在左下角 Summary 填 `Release v0.2.0`，Description 可填 `First public desktop source release`。
8. 点 **Commit to main**。这是你的第一条真实 Git 记录。
9. 点上方 **Publish repository**，取消 **Keep this code private**，再确认发布。

如果你在 GitHub 网页看到 README 和文件列表，源码发布成功。

## B. 允许自动流程上传安装包

1. 在仓库网页点 **Settings**。
2. 左侧点 **Actions → General**。
3. 找到 **Workflow permissions**。
4. 选择 **Read and write permissions**，点 Save。

这个权限只让仓库自己的发布流程把构建结果放进 Release，不会读取用户微信数据。

## C. 创建 V0.2.0 Release

1. 仓库首页右侧点 **Releases**，再点 **Draft a new release**。
2. 点 **Choose a tag**，输入 `v0.2.0`。
3. 选择 **Create new tag: v0.2.0 on publish**。
4. Release title 填 `微信年轮 V0.2.0`。
5. 打开源码中的 `RELEASE_NOTES_v0.2.0.md`，复制内容到说明框。
6. 点 **Publish release**。

创建标签会触发 `.github/workflows/release.yml`。点仓库上方 **Actions**，打开 `Build desktop release` 查看进度。三个构建都变绿后，刷新 Release 页面。

## D. 下载哪个安装包

| 你的电脑 | 下载文件名含有 | 推荐格式 |
|---|---|---|
| M1/M2/M3/M4/M5 Mac | `mac-arm64` | `.dmg` |
| Intel Mac | `mac-x64` | `.dmg` |
| 64 位 Windows | `win-x64` | `.exe` 安装版或 `.zip` 免安装版 |

在 Mac 左上角点苹果图标 → **关于本机**，看到“芯片 Apple M…”就选 arm64；看到“处理器 Intel”就选 x64。

## E. 未签名应用怎么打开

V0.2.0 为了保持 0 成本没有购买 Apple Developer 和 Windows 代码签名证书，因此会有系统拦截。

Mac：

1. 打开 DMG，把“微信年轮”拖进 Applications。
2. 在 Finder 的 Applications 中，按住 Control 点“微信年轮”，选择 **打开**。
3. 再次点 **打开**。如果按钮没出现，去 **系统设置 → 隐私与安全性**，在拦截提示旁点“仍要打开”。
4. 不要关闭 SIP，也不需要在终端执行移除隔离属性的命令。

Windows：

1. SmartScreen 出现后点 **更多信息**。
2. 确认文件来自你自己的 GitHub Release，再点 **仍要运行**。

开源不等于自动安全。用户应核对仓库地址、Release 标签和 Actions 构建记录。

## F. 以后发新版本

假设下一版是 V0.2.1：

1. 把 `package.json` 的 `version` 改成 `0.2.1`。
2. 把 `src/version.js` 的 `APP_VERSION` 改成 `0.2.1`。
3. 在 `CHANGELOG.md` 顶部新增真实完成的内容，并同步应用内 `ChangelogPage`。
4. GitHub Desktop 填真实摘要并 Commit，再 Push origin。
5. GitHub 网页新建 tag `v0.2.1` 和 Release。

标签、应用版本和 `package.json` 必须一致。不要先写“已完成”再慢慢做，也不要给从未存在的版本补造 Git 标签。

## 常见失败

### Actions 显示红色叉号

点进失败步骤看第一段红字：

- `Resource not accessible by integration`：回到步骤 B 打开 Read and write permissions。
- `npm ci` 失败：确认 `package-lock.json` 已上传，并且没有只改 `package.json`。
- 某个安装包找不到：确认版本号只包含数字和点，重新运行失败任务。

### Release 里暂时没有安装包

刚发布时为空属于正常。等 Actions 三个平台全部完成再刷新。如果只手动运行 workflow 而不是推送 `v*` 标签，流程只构建供检查，不会创建正式 Release。

### Mac 版能不能在 Windows 上打包

本地通常不行，所以这里让 GitHub 的 Mac 运行器打 Mac 包、Windows 运行器打 Windows 包。你的电脑只负责上传源码。
