import test from "node:test";
import assert from "node:assert/strict";
import { parseImport, mergeDatasets } from "../src/lib/parser.js";
import { analyze, availableYears, coverage } from "../src/lib/analytics.js";
import { serializeDataset } from "../src/lib/export.js";

test("parses official-style WeChat payment CSV and totals red packets/transfers", () => {
  const csv = `微信支付账单明细,,,,\n交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态\n2025-02-01 10:30:00,微信红包,小王,红包,支出,¥12.50,支付成功\n2025-02-02 11:00:00,转账,小李,转账,支出,¥300.00,支付成功\n2025-02-03 11:00:00,微信红包,小赵,红包,收入,¥8.88,已存入零钱`;
  const data = parseImport("微信支付账单.csv", csv);
  const stats = analyze(data, 2025);
  assert.equal(data.payments.length, 3);
  assert.equal(stats.redSentCount, 1);
  assert.equal(stats.redSentAmount, "12.50");
  assert.equal(stats.redReceivedAmount, "8.88");
  assert.equal(stats.transferSentAmount, "300.00");
});

test("parses messages and only counts own detectable recalls", () => {
  const json = JSON.stringify({ messages: [
    { time: "2025-01-01 09:00:00", isSend: true, type: 1, content: "你好", contact: "好友" },
    { time: "2025-01-01 09:01:00", isSend: false, type: 1, content: "在的", contact: "好友" },
    { time: "2025-01-01 09:02:00", isSend: true, type: 10000, content: "你撤回了一条消息", contact: "好友" }
  ] });
  const data = parseImport("messages.json", json);
  const stats = analyze(data, 2025);
  assert.equal(stats.sent, 1);
  assert.equal(stats.received, 1);
  assert.equal(stats.ownRevokes, 1);
});

test("merges imports without duplicating identical records", () => {
  const source = parseImport("messages.json", JSON.stringify({ messages: [{ time: "2025-01-01 09:00:00", isSend: true, type: 1, content: "你好", contact: "好友" }] }));
  const merged = mergeDatasets(source, source);
  assert.equal(merged.messages.length, 1);
});

test("parses wechat-export-macos JSON and recognizes messages sent by me", () => {
  const data = parseImport("张三-chat.json", JSON.stringify([
    { time: "2025-01-02 12:30:00", sender: "我", type: 1, content: "你好", server_id: 101 },
    { time: "2025-01-02 12:31:00", sender: "张三", type: 3, content: "", server_id: 102 },
    { time: "2025-01-02 12:32:00", sender: "系统", type: 10002, content: "你撤回了一条消息", server_id: 103 }
  ]));
  const stats = analyze(data, 2025);
  assert.equal(data.messages[0].isSend, true);
  assert.equal(data.messages[0].contact, "张三");
  assert.equal(data.messages[1].type, "image");
  assert.equal(stats.sent, 1);
  assert.equal(stats.ownRevokes, 1);
});

test("parses wechat-export-macos CSV headers", () => {
  const data = parseImport("家人-chat.csv", "时间,发送者,类型,内容\n2025-02-03 09:00:00,我,文本,早上好\n");
  assert.equal(data.messages.length, 1);
  assert.equal(data.messages[0].isSend, true);
  assert.equal(data.messages[0].contact, "家人");
});

test("parses EchoTrace/WeFlow-style capitalized fields inside sessions", () => {
  const data = parseImport("compatible.json", JSON.stringify({
    Sessions: [{
      NickName: "产品群",
      Messages: [
        { MsgSvrID: "9001", CreateTime: 1736067600, IsSender: 1, Type: 1, StrContent: "开会吗" },
        { MsgSvrID: "9002", CreateTime: 1736067660, IsSender: 0, Type: 3, StrContent: "" },
      ],
    }],
  }));
  assert.equal(data.messages.length, 2);
  assert.equal(data.messages[0].contact, "产品群");
  assert.equal(data.messages[0].isSend, true);
  assert.equal(data.messages[1].type, "image");
});

test("exports and reimports the versioned WeChat Yearbook JSON schema", () => {
  const source = parseImport("messages.json", JSON.stringify({ messages: [
    { time: "2025-04-05 13:00:00", isSend: true, type: 1, content: "稍后见", contact: "朋友", deletedMarker: true },
  ] }));
  const exported = serializeDataset(source);
  const restored = parseImport("yearbook.json", exported);
  assert.equal(restored.source, "微信年轮标准 JSON");
  assert.equal(restored.messages[0].content, "稍后见");
  assert.equal(restored.messages[0].deletedMarker, true);
});

test("keeps payment categories and totals through a standard JSON round trip", () => {
  const source = parseImport("微信支付账单.csv", `微信支付账单明细,,,,\n交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态\n2025-02-01 10:30:00,微信红包,小王,红包,支出,¥12.50,支付成功\n2025-02-02 11:00:00,转账,小李,转账,支出,¥300.00,支付成功`);
  const restored = parseImport("yearbook.json", serializeDataset(source));
  const stats = analyze(restored, 2025);
  assert.equal(stats.redSentAmount, "12.50");
  assert.equal(stats.transferSentAmount, "300.00");
});

test("exports only the selected year when a year scope is requested", () => {
  const source = parseImport("messages.json", JSON.stringify({ messages: [
    { time: "2024-04-05 13:00:00", isSend: true, type: 1, content: "去年", contact: "朋友" },
    { time: "2025-04-05 13:00:00", isSend: true, type: 1, content: "今年", contact: "朋友" },
  ] }));
  const exported = JSON.parse(serializeDataset(source, { year: 2025 }));
  assert.equal(exported.scope.type, "year");
  assert.equal(exported.scope.year, 2025);
  assert.equal(exported.messages.length, 1);
  assert.match(exported.messages[0].time, /^2025-/);
});

test("reads nested child messages even when the session object also has a timestamp", () => {
  const data = parseImport("nested.json", JSON.stringify({ data: {
    createTime: "2025-01-01 08:00:00",
    name: "产品群",
    messages: [
      { createTime: "2025-01-01 09:00:00", isSend: true, type: 1, content: "开会吗" },
    ],
  } }));
  assert.equal(data.messages.length, 1);
  assert.equal(data.messages[0].contact, "产品群");
  assert.equal(data.messages[0].content, "开会吗");
});

test("reads capitalized Data containers and explicit moment authors", () => {
  const data = parseImport("capitalized.json", JSON.stringify({ Data: {
    Sessions: [{ Name: "家人", Messages: [{ CreateTime: 1736067600, IsSender: 1, Type: 1, StrContent: "早安" }] }],
    Moments: [
      { CreateTime: 1736067600, Type: "comment", Sender: "我", Content: "真好看" },
      { CreateTime: 1736067660, Type: "comment", Sender: "朋友", Content: "谢谢" },
    ],
  } }));
  assert.equal(data.messages.length, 1);
  assert.equal(data.messages[0].contact, "家人");
  assert.equal(analyze(data, 2025).momentsComments, 1);
});

test("does not assume moments without an ownership field belong to the user", () => {
  const data = parseImport("moments.json", JSON.stringify({ moments: [
    { time: "2025-06-01 12:00:00", type: "comment", content: "别人留下的评论" },
    { time: "2025-06-01 12:01:00", type: "comment", isOwn: true, content: "我留下的评论" },
  ] }));
  assert.equal(analyze(data, 2025).momentsComments, 1);
  assert.ok(data.warnings.some((warning) => warning.includes("归属")));
});

test("recognizes an English-header moments CSV instead of treating it as chat", () => {
  const data = parseImport("moments.csv", "time,type,isOwn,content\n2025-06-01 12:00:00,post,true,记录一天\n");
  assert.equal(data.source, "朋友圈 CSV");
  assert.equal(data.moments.length, 1);
  assert.equal(analyze(data, 2025).momentsPosts, 1);
});

test("reports invalid rows instead of silently dropping them", () => {
  const data = parseImport("messages.csv", "时间,发送者,类型,内容\n无效时间,我,文本,坏行\n2025-02-03 09:00:00,我,文本,好行\n");
  assert.equal(data.messages.length, 1);
  assert.equal(data.diagnostics[0].skipped, 1);
  assert.ok(data.warnings.some((warning) => warning.includes("跳过 1")));
});

test("only calls an official bill complete when its declared ranges cover the whole year", () => {
  const partial = parseImport("partial.csv", `微信支付账单明细,,,,\n起始时间：[2025-01-01 00:00:00] 终止时间：[2025-01-31 23:59:59],,,,\n交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态\n2025-01-03 10:00:00,转账,小李,转账,支出,¥10.00,支付成功`);
  assert.equal(coverage(partial, 2025).payments.level, "partial");

  const full = parseImport("full.csv", `微信支付账单明细,,,,\n起始时间：[2025-01-01 00:00:00] 终止时间：[2025-12-31 23:59:59],,,,\n交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态\n2025-01-03 10:00:00,转账,小李,转账,支出,¥10.00,支付成功`);
  assert.equal(coverage(full, 2025).payments.level, "complete");
});

test("treats a declared full-year bill with zero transactions as a real complete zero", () => {
  const data = parseImport("empty.csv", `微信支付账单明细,,,,\n起始时间：[2025-01-01 00:00:00] 终止时间：[2025-12-31 23:59:59],,,,\n交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态`);
  assert.deepEqual(availableYears(data), [2025]);
  assert.equal(coverage(data, 2025).payments.level, "complete");
  assert.equal(analyze(data, 2025).transferSentCount, 0);
  const restored = parseImport("empty-yearbook.json", serializeDataset(data));
  assert.equal(coverage(restored, 2025).payments.level, "complete");
});

test("combines adjacent bill ranges before assessing yearly coverage", () => {
  const firstHalf = parseImport("first.csv", `微信支付账单明细,,,,\n起始时间：[2025-01-01 00:00:00] 终止时间：[2025-06-30 23:59:59],,,,\n交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态\n2025-02-03 10:00:00,转账,甲,转账,支出,¥10.00,支付成功`);
  const secondHalf = parseImport("second.csv", `微信支付账单明细,,,,\n起始时间：[2025-07-01 00:00:00] 终止时间：[2025-12-31 23:59:59],,,,\n交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态\n2025-08-03 10:00:00,转账,乙,转账,支出,¥20.00,支付成功`);
  assert.equal(coverage(mergeDatasets(firstHalf, secondHalf), 2025).payments.level, "complete");
});

test("does not count incoming system notices as received chat messages", () => {
  const data = parseImport("messages.json", JSON.stringify({ messages: [
    { time: "2025-01-01 09:00:00", isSend: false, type: 10000, content: "你已加入群聊", contact: "群聊" },
  ] }));
  const stats = analyze(data, 2025);
  assert.equal(stats.received, 0);
  assert.equal(stats.peakHour, null);
});

test("marks imported data from another year instead of presenting a real zero", () => {
  const data = parseImport("messages.json", JSON.stringify({ messages: [
    { time: "2024-04-05 13:00:00", isSend: true, type: 1, content: "去年", contact: "朋友" },
  ] }));
  const quality = coverage(data, 2025);
  assert.equal(quality.messages.level, "out_of_year");
  assert.equal(quality.messages.hasYear, false);
});

test("keeps a local-day streak across daylight-saving clock changes", () => {
  const data = parseImport("messages.json", JSON.stringify({ messages: [
    { time: "2025-03-08 10:00:00", isSend: true, type: 1, content: "一", contact: "朋友" },
    { time: "2025-03-09 10:00:00", isSend: true, type: 1, content: "二", contact: "朋友" },
    { time: "2025-03-10 10:00:00", isSend: true, type: 1, content: "三", contact: "朋友" },
  ] }));
  assert.equal(analyze(data, 2025).streak, 3);
});
