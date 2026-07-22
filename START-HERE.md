# 新手第一步：把微信年轮发布到你的 GitHub

你不需要先学会编程。最省事的路线是：**GitHub Desktop 上传源码 → GitHub 网页创建 V0.2.0 Release → 等它自动生成双系统安装包。**

## 开始前准备

1. 注册一个 GitHub 账号。
2. 下载并安装 [GitHub Desktop](https://desktop.github.com/)。
3. 解压 `wechat-yearbook-v0.2.0-source.zip`，得到 `wechat-yearbook` 文件夹。
4. 文件夹里不要放你自己的聊天记录、账单、数据库或密钥。

## 上传源码（全程点鼠标）

1. 打开 GitHub Desktop，登录你的 GitHub 账号。
2. 菜单点 **File → Add Local Repository**，选择解压后的 `wechat-yearbook` 文件夹。
3. 它会提示这还不是 Git 仓库，点 **create a repository**。
4. Name 保持 `wechat-yearbook`，Git Ignore 选 **None**，License 选 **None**（源码里已经有），然后点 **Create Repository**。
5. 左下角 Summary 填 `Release v0.2.0`，点 **Commit to main**。
6. 点顶部 **Publish repository**。
7. 取消勾选 **Keep this code private**，再点 **Publish Repository**。

此时所有访客已经能看到 README、版本记录和源码。不要伪造 V0.1.x 的 Git 提交或标签；它们是之前网页版本的真实产品记录，但你的 GitHub 仓库从这次 V0.2.0 首次提交开始最诚实。

## 开启安装包自动发布

1. 在 GitHub 网页打开刚发布的仓库。
2. 点 **Settings → Actions → General**。
3. 滚到 **Workflow permissions**，选择 **Read and write permissions**，点 Save。
4. 回仓库首页，点右侧 **Releases → Create a new release**。
5. 点 **Choose a tag**，输入 `v0.2.0`，选择 **Create new tag: v0.2.0 on publish**。
6. Release title 填 `微信年轮 V0.2.0`。
7. 把 `RELEASE_NOTES_v0.2.0.md` 的内容复制到说明框，点 **Publish release**。

发布后点仓库上方 **Actions**，会看到 `Build desktop release` 正在运行。通常几分钟到十几分钟。完成后刷新 Release 页面，Assets 里会出现：

- `mac-arm64`：M1/M2/M3/M4/M5 等 Apple 芯片 Mac
- `mac-x64`：Intel 芯片 Mac
- `win-x64`：64 位 Windows

详细截图式步骤、安装拦截提示和后续更新方式见 [docs/BEGINNER-GITHUB-GUIDE.md](docs/BEGINNER-GITHUB-GUIDE.md)。
