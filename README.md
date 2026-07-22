# 微信年轮

> 把一年里容易被忽略的微信小事，变成一份只属于自己的年度档案。

当前版本：**V0.2.0 · 双平台开源桌面预览版**

微信年轮是一款本地优先的微信年度报告工具。导入自己的聊天 JSON/CSV、微信支付个人对账 CSV 或朋友圈结构化记录后，它会在本机统计消息、活跃日、可检测撤回、红包、转账和朋友圈足迹，并生成简洁的故事式年报与隐私分享图。

本项目不是腾讯或微信官方产品。“微信”是其权利人的商标。

## 它能统计什么

- 发出/收到多少条消息、活跃多少天、最长连续活跃多少天
- 12 个月和 24 小时分布，文字、图片、语音、视频、表情、文件等类型
- 发消息最多的会话（仅在本机显示，分享图默认隐藏姓名）
- 仍保留系统痕迹的本人撤回，以及数据中明确存在的删除标记
- 识别到的朋友圈发表、评论和点赞
- 微信支付账单里的红包/转账收支笔数与金额
- 每类数据的“完整 / 可能不完整 / 未导入”与整体覆盖分

它不会声称能找回彻底删除且毫无残留的记录，也不会把未导入数据时的 `0` 冒充真实结论。

## EchoTrace + WeFlow 给我们的经验

- 借鉴 EchoTrace 的本地优先、导出与分析服务分层、年度报告思路。
- 吸取 WeFlow 在取密钥/解密能力被移除后的教训：主程序不绑定微信进程扫描、密钥提取或数据库解密。
- 微信年轮自己的方案是“稳定主程序 + 标准 JSON/CSV + 可选独立适配器”。微信更新时，报告和分析层仍可正常维护。
- 不要求关闭 macOS SIP，不捆绑第三方解密代码，不把用户文件上传到云端。

这属于架构与产品经验参考，不是两个项目的代码拼接。详见 [第三方说明](THIRD_PARTY_NOTICES.md) 和 [架构文档](docs/ARCHITECTURE.md)。

## 小白从这里开始

如果你准备把项目发布到自己的 GitHub，请按 [START-HERE.md](START-HERE.md) 操作。里面从解压源码、在 GitHub Desktop 创建仓库，到生成 Mac/Windows 安装包，都按点击顺序写好了。

## 本地运行

需要 Node.js 22。进入项目文件夹后运行：

```bash
npm install
npm run dev:desktop
```

检查代码：

```bash
npm run check
```

在对应系统本机打包：

```bash
npm run dist:mac
npm run dist:win
```

公开 GitHub 仓库推送 `v*` 标签后，GitHub Actions 会免费构建：

- macOS Apple 芯片（arm64）DMG + ZIP
- macOS Intel（x64）DMG + ZIP
- Windows x64 安装版 + 便携版

安装包暂未付费签名，因此系统会显示“未知开发者/未知发布者”。这不影响源码审计和本地使用，处理方法写在 [发布教程](docs/BEGINNER-GITHUB-GUIDE.md) 中。

## 导入格式

1. 微信支付：官方“用于个人对账”的 CSV。
2. 聊天：常见 JSON/CSV，以及多种 EchoTrace/WeFlow 风格字段和嵌套会话结构。
3. 朋友圈：包含 `time`、`type`、`isOwn` 等字段的 JSON/CSV，结果持续标记为可能不完整。
4. 微信年轮标准 JSON：可在“数据与隐私”页导出后再次导入。

完整字段见 [数据格式](docs/DATA-FORMAT.md)。可先导入 `examples/wechat-yearbook-example.json` 验证流程。

## 隐私与安全

- 不要求微信账号、密码或支付密码。
- 原始文件只由当前设备读取；关闭应用后不会复制到应用目录。
- 不分析他人账号，不提供监控、窃取或绕过系统保护的能力。
- 分享图不含聊天原文、联系人、群名和具体金额。
- 标准 JSON 会包含原始内容与联系人，只适合本人备份，不应公开上传。

详见 [隐私说明](PRIVACY.md) 与 [安全边界](docs/SECURITY-BOUNDARY.md)。

## 文档

- [小白发布 GitHub 与 Release](docs/BEGINNER-GITHUB-GUIDE.md)
- [数据格式与兼容字段](docs/DATA-FORMAT.md)
- [项目架构](docs/ARCHITECTURE.md)
- [安全边界](docs/SECURITY-BOUNDARY.md)
- [版本记录](CHANGELOG.md)
- [路线图](ROADMAP.md)
- [参与贡献](CONTRIBUTING.md)

## 许可证

项目自身代码采用 [MIT License](LICENSE)。第三方项目仍遵循各自许可证；微信年轮 V0.2.0 未复制或捆绑 EchoTrace、WeFlow、CipherTalk 的取密钥或解密实现。
