# 微信年轮 Mac 候选

V0.5.2 面向 Apple 芯片 Mac，已补齐八个板块可视化。先准备 Mac 微信合并转发的 ZIP 或 TXT，也可导入合成样例，选择「测试本人」作为发送人。[合成 TXT](examples/wechat-forward-example.txt)

## 体验报告

1. 打开微信年轮，点「导入记录」选择文件。
2. 也可以拖入聊天 ZIP 或 TXT。对照文件中的昵称选择自己，并填写会话名称。导入支付账单时选择解压后的 CSV。
3. 查看年报或详细数据。分享前可预览 PNG，包含聊天原文的标准 JSON 用于本人备份。

首页「怎么拿到文件？」提供操作步骤。文件只有选中的消息，年报会标明覆盖范围。[导入格式](docs/DATA-FORMAT.md)

## 构建候选

在 Apple 芯片 Mac 上安装 Node.js 22，然后进入项目目录运行：

```sh
npm ci
npm run check
npm audit --audit-level=high
npm run dist:mac
npm run verify:packaged -- release/mac-arm64
```

构建产物在 `release/`。本地候选使用临时签名。正式分发需完成 Developer ID 签名、Apple 公证与干净设备的首次安装验收。[分发验收](docs/releases/v0.5.2.md)
