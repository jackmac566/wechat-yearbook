# 数据格式与兼容说明

## 推荐：微信年轮标准 JSON

在“数据与隐私”页面可以导出。文件含敏感原文与联系人，只适合本人备份和本地工具对接。

```json
{
  "schemaVersion": "1.0",
  "generator": "微信年轮 0.2.0",
  "confidence": {
    "messages": "partial",
    "payments": "complete",
    "moments": "missing"
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

## 聊天字段

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

## 朋友圈

```json
{
  "moments": [
    { "time": "2025-01-02 12:00:00", "type": "post", "isOwn": true, "content": "记录" },
    { "time": "2025-01-03 12:00:00", "type": "comment", "isOwn": true, "content": "好看" }
  ]
}
```

`type` 可为 `post`、`comment`、`like`。朋友圈导出往往只覆盖本机加载内容，因此默认可信度为 `partial`。

## 删除与撤回

- `isOwnRevoke=true` 或仍存在“你撤回了一条消息”等记录时，才能统计本人撤回。
- `deletedMarker=true` 只表示导出数据明确带有删除标记。
- 完全不存在的消息无法从空白处推断，不能用相邻 ID 或总数差伪造。
