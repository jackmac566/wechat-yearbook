# 安全政策

## 支持版本

当前仅对最新公开版本 V0.2.x 提供安全修复。

## 报告安全问题

公开仓库建立后，请在 GitHub 的 **Settings → Security → Private vulnerability reporting** 中启用私密漏洞报告。不要在公开 Issue 中附上真实聊天、账单、数据库、密钥、手机号或支付信息。

## 明确不接受的用途

- 未经本人明确授权读取他人账号或设备
- 账号窃取、密钥窃取、绕过系统安全保护或后台监控
- 要求用户关闭 SIP、关闭杀毒软件或上传原始微信数据库到陌生服务器

## 构建安全

依赖版本已固定在 `package-lock.json`。发布包由公开 GitHub Actions 从对应标签源码构建，构建前执行测试与 `npm audit`，并随 Release 提供 SHA-256 校验和和 GitHub Artifact Attestation。发布流程拒绝覆盖已有附件，并兼容 Immutable Releases。

V0.2.1 未购买 Apple/Windows 商业代码签名，因此安装时仍会出现系统安全提示；这与源码审计、构建来源和文件完整性是不同问题。请只从项目自己的 Release 下载并核对校验和，不要通过关闭 SIP 或杀毒软件来绕过问题。
