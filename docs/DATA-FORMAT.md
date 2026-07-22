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
      { "start": "2025-01-01T00:00:00.000Z", "end": "2025-12-31T23:59:59.000Z", "declared": true }
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

“完整”不等于“文件里有一条交易”。只有账单前言声明的起止日期覆盖完整自然年，或多个已导入账单的连续声明范围合起来覆盖整年，该年份才显示为完整；没有起止范围时显示“可能不完整”。

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
- 桌面端“选择整个导出文件夹”会递归选择其中的 `.json`、`.csv`、`.txt`；其他扩展名自动忽略。
- “数据与隐私 → 本次导入检查”会显示每个文件的识别数与跳过数。无效时间、空结构或不支持的表头不会静默冒充成功。
- 微信原始数据库、ZIP、图片、视频不是直接支持的导入格式。ZIP 应先在本机解压；原始数据库应先由可信、兼容且有权使用的工具导出成结构化文件。

## 删除与撤回

- `isOwnRevoke=true` 或仍存在“你撤回了一条消息”等记录时，才能统计本人撤回。
- `deletedMarker=true` 只表示导出数据明确带有删除标记。
- 完全不存在的消息无法从空白处推断，不能用相邻 ID 或总数差伪造。
