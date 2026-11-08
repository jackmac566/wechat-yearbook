# 数据格式与兼容说明

## 推荐：微信年轮标准 JSON

在“数据与隐私”页面可以导出。文件含敏感原文与联系人，只适合本人备份和本地工具对接。

```json
{
  "schemaVersion": "1.0",
  "generator": "微信年轮 0.2.1",
  "scope": { "type": "year", "year": 2025 },
  "confidence": {
    "messages": "partial",
    "payments": "complete",
    "moments": "missing"
  },
  "coverageRanges": {
    "messages": [],
    "payments": [
      { "start": "2025-01-01T00:00:00+08:00", "end": "2025-12-31T23:59:59+08:00", "declared": true }
    ],
    "moments": []
  },
  "messages": [
    {
      "id": "123",
      "time": "2025-01-01T01:00:00.000Z",
      "isSend": true,
      "type": "text",
      "content": "新年快乐",
      "contact": "好友",
      "duration": 0,
      "isOwnRevoke": false,
      "deletedMarker": false
    }
  ],
  "payments": [],
  "moments": []
}
```

示例的账期按 UTC+08:00 的本地自然年编写。应用按设备时区分析年份，按年导出时会把覆盖区间裁切到选定年份。

## 聊天字段

### Mac 微信合并转发

- ZIP 支持根目录或唯一一层包装目录中的 `聊天记录.txt`。ZIP 上限 128 MiB，内部 TXT 上限 8 MiB。只读取文本，附件只按文本里的标记计数。
- TXT 记录由以 `·` 开头的发送人、下一行本地日期时间及随后正文组成。可保留多行正文，日期以分钟为精度。
- 导入时选择本人昵称，或明确选择本批没有自己的消息。昵称相同但属于不同人时，现有格式无法区分。
- 同一会话分批导入时请填写相同会话名称，并选择互不重叠的批次。应用按整份片段的内容指纹去除重复导入。不同片段会分别统计，即使时间或内容相同。
- 若使用渡口的多批合并归档，请解压并多选 `batches/` 内各批原始 `聊天记录.txt`。手机微信的迁移备份和支付账单 ZIP 使用各自的获取流程。
- 备份里的转发消息带 `sourceFormat: "wechat-transcript"`、`sender` 与 `fragmentRef`。重导入后仍标为片段覆盖。昵称与聊天原文同属私密数据。

公开格式依据为渡口解析实现与微信流发布者的合成夹具。[渡口格式实现](https://github.com/qzz0518/Dukou/blob/v0.1.19/Sources/DukouCore/WeChatForward.swift) · [微信流合成夹具](https://github.com/freestylefly/WeChatBridge/tree/3d181a2cc29a9e0b2534f2c36df4ea8d918c0d32/macos/Tests/WeChatBridgeAppTests/Fixtures)

### JSON 和 CSV

每条消息至少需要可解析的时间。常用别名会自动映射：

| 标准字段 | 可识别示例 |
|---|---|
| time | `time`, `CreateTime`, `msgCreateTime`, `timestamp`, `发送时间` |
| isSend | `isSend`, `IsSender`, `fromMe`, `sender=我`, `是否发送` |
| type | `type`, `Type`, `MsgType`, `messageType`, `消息类型` |
| content | `content`, `StrContent`, `MsgContent`, `message`, `内容` |
| contact | `contact`, `Talker`, `NickName`, `Remark`, `sessionName`, `会话` |
| id | `id`, `MsgSvrID`, `MsgLocalID`, `server_id`, `消息ID` |
| duration | `duration`, `VoiceLength`, `voiceDuration`, `时长` |

支持 `sessions[].messages[]`、`Sessions[].Messages[]`、`chatRecords`、`messageList` 等常见嵌套结构。这是字段级兼容，不代表对 EchoTrace 或 WeFlow 每个历史版本作 100% 承诺。

常见数字类型：1 文字、3 图片、34 语音、43 视频、47 表情、49 链接/文件、10000/10002 系统或撤回。解析器也识别英文/中文类型名。

## 微信支付 CSV

上传手机微信申请的“用于个人对账”CSV。解析器自动寻找包含 `交易时间` 的表头，并使用 `交易类型`、`收/支`、`金额(元)`、`当前状态`、`交易单号` 等字段。失败、退款、退还、撤销、关闭与取消交易不会进入有效金额。

账单前言声明的起止时间需要连续覆盖本地自然年的首尾秒，该年份才显示为完整。多个账单的连续声明范围可以合并判断。没有可用的声明范围，或已识别的账单中存在解析失败的行时，账单标为“可能不完整”。

## 朋友圈

```json
{
  "moments": [
    { "time": "2025-01-02 12:00:00", "type": "post", "isOwn": true, "content": "记录" },
    { "time": "2025-01-03 12:00:00", "type": "comment", "isOwn": true, "content": "好看" }
  ]
}
```

`type` 可为 `post`、`comment`、`like`。`isOwn` 必须明确表示这条发表、评论或点赞是不是当前用户本人操作；缺失时不会默认算作本人。朋友圈导出往往只覆盖本机加载内容，因此默认可信度为 `partial`。

## 多文件与文件夹导入

- 可以把聊天、支付、朋友圈和标准 JSON 一次多选，应用会按消息 ID/会话或稳定字段去重。
- 桌面端「选择整个导出文件夹」会递归选择其中的 `.json`、`.csv`、`.txt`、`.zip`，其他扩展名会被忽略。
- 「数据与隐私 → 导入检查」显示最近一批的失败原因和已导入文件的识别数、跳过数。
- 导入期间可以取消本批次。成功的文件会在批次结束时合并，取消时保留之前的年报。
- ZIP 导入仅用于聊天转发包。微信支付账单请先在本机解压，选择个人对账 CSV。

## 删除与撤回

- `isOwnRevoke=true` 或仍存在“你撤回了一条消息”等记录时，才能统计本人撤回。
- `deletedMarker=true` 只表示导出数据明确带有删除标记。
- 完全不存在的消息无法从空白处推断，不能用相邻 ID 或总数差伪造。
