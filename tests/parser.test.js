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

test("keeps unknown message direction separate from explicit sent and received directions", () => {
  const messages = [
    {},
    { isSend: "unspecified" },
    { sender: "只有昵称" },
    { isSend: null, sender: "我" },
    { isSend: "0" },
    { direction: "outgoing" },
    { fromMe: false },
  ].map((fields) => ({ time: "2025-04-05 13:00:00", type: 1, content: "示例", ...fields }));
  const data = parseImport("directions.json", JSON.stringify({ messages }));
  const expected = [null, null, null, null, false, true, false];
  assert.deepEqual(data.messages.map(({ isSend }) => isSend), expected);
  const stats = analyze(data, 2025);
  assert.deepEqual([stats.sent, stats.received, stats.directionUnknown], [1, 2, 4]);
  const exported = serializeDataset(data);
  assert.deepEqual(JSON.parse(exported).messages.map(({ isSend }) => isSend), expected);
  assert.deepEqual(parseImport("backup.json", exported).messages.map(({ isSend }) => isSend), expected);
});

test("counts legacy directionless messages as unknown without touching received counts", () => {
  const data = parseImport("legacy.json", JSON.stringify({ messages: [
    { time: "2025-04-05 13:00:00", type: 1, content: "旧格式没有方向字段", contact: "旧会话" },
    { time: "2025-04-05 13:01:00", type: 1, content: "旧备份明确存了收到", contact: "旧会话", isSend: false },
    { time: "2025-04-05 13:02:00", type: 1, content: "旧备份明确存了发出", contact: "旧会话", isSend: true },
  ] }));
  assert.deepEqual(data.messages.map(({ isSend }) => isSend), [null, false, true]);

  const stats = analyze(data, 2025);
  assert.deepEqual([stats.sent, stats.received, stats.directionUnknown], [1, 1, 1]);
  const day = stats.dailyCounts.find((item) => item.date === "2025-04-05");
  assert.deepEqual([day.sent, day.received, day.unknown], [1, 1, 1]);
  assert.equal(stats.receivedMonthCounts[3], 1);
  assert.equal(stats.receivedHourCounts[13], 1);
  assert.deepEqual([stats.conversations[0].sent, stats.conversations[0].received, stats.conversations[0].unknown], [1, 1, 1]);

  const restored = parseImport("yearbook.json", serializeDataset(data));
  assert.equal(restored.source, "微信年轮标准 JSON");
  assert.deepEqual(restored.messages.map(({ isSend }) => isSend), [null, false, true]);
  assert.deepEqual([analyze(restored, 2025).sent, analyze(restored, 2025).received, analyze(restored, 2025).directionUnknown], [1, 1, 1]);
});

test("distinguishes missing CSV flags while retaining explicitly known legacy sender labels", () => {
  const messages = parseImport("directions.csv", [
    "时间,发送者,是否发送,内容",
    "2025-04-05 13:00:00,, ,示例",
    "2025-04-05 13:01:00,我,,示例",
    "2025-04-05 13:02:00,旧导出对方,,示例",
    "2025-04-05 13:03:00,旧导出对方,不明,示例",
    "2025-04-05 13:04:00,,否,示例",
  ].join("\n")).messages;
  assert.deepEqual(messages.map(({ isSend }) => isSend), [null, true, false, null, false]);
});

test("does not replace a known direction with unknown when reimporting the same stable message", () => {
  const message = { id: "123", contact: "示例会话", time: "2025-04-05 13:00:00", content: "示例" };
  const known = parseImport("known.json", JSON.stringify({ messages: [{ ...message, isSend: false }] }));
  const unknown = parseImport("unknown.json", JSON.stringify({ messages: [message] }));
  for (const merged of [mergeDatasets(known, unknown), mergeDatasets(unknown, known)]) {
    assert.equal(merged.messages.length, 1);
    assert.equal(merged.messages[0].isSend, false);
  }
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

test("keeps ordinary chat text out of recall and card statistics", () => {
  const rows = [
    { type: 1, content: "我撤回了刚才的提议" },
    { type: "text", content: "你撤回了一条消息" },
    { type: "文字", content: "下次转账和红包记得 call 我" },
    { content: "application" },
    { type: "file", content: "年度汇总" },
    { type: 49, content: "<appmsg><type>2000</type></appmsg>" },
    { type: 10002, content: "<sysmsg type=\"pat\"><pat/></sysmsg>" },
    { type: 10002, content: "<sysmsg type=\"other\"/>" },
    { type: 10000, content: "你撤回了一条消息" },
  ].map((row) => ({ time: "2025-06-01 12:00:00", isSend: true, ...row }));
  const data = parseImport("messages.json", JSON.stringify({ messages: rows }));
  assert.deepEqual(data.messages.map((row) => row.type), ["text", "text", "text", "text", "file", "transfer", "poke", "system", "revoke"]);
  assert.equal(analyze(data, 2025).ownRevokes, 1);
});

test("uses the enclosing conversation and reports malformed JSON chat rows", () => {
  const raw = { Sessions: [{
    Name: "工作群",
    Type: "group",
    CreateTime: "2025-01-01 08:00:00",
    Messages: [
      { Time: "2025-01-01 09:00:00", Sender: "甲", Content: "收到" },
      { Time: "2025-01-01 09:01:00", Sender: "我", Content: "好的" },
      { Sender: "乙", Content: "缺少时间" },
      null,
    ],
  }] };
  const data = parseImport("聊天记录.json", `\uFEFF${JSON.stringify(raw)}`);
  assert.deepEqual(data.messages.map((message) => [message.contact, message.isSend]), [["工作群", false], ["工作群", true]]);
  assert.deepEqual(data.diagnostics[0], { file: "聊天记录.json", kind: "结构化数据", parsed: 2, skipped: 2 });
});

test("merges repeated imports without deleting legitimate matching rows in one file", () => {
  const time = "2025-06-01 12:00:00";
  const chat = { time, type: "text", content: "好", isSend: true };
  const transfer = { time, type: "transfer", direction: "out", amount: 10 };
  const comment = { time, type: "comment", isOwn: true, content: "赞" };
  const data = parseImport("backup.json", JSON.stringify({
    messages: [chat, { ...chat, isSend: false }, chat],
    payments: [transfer, { ...transfer, direction: "in" }],
    moments: [comment, { ...comment, isOwn: false }],
  }));
  const merged = mergeDatasets(data, data);
  assert.deepEqual(merged.messages.map((message) => message.isSend), [true, false, true]);
  assert.deepEqual(merged.payments.map((payment) => payment.direction), ["out", "in"]);
  assert.deepEqual(merged.moments.map((moment) => moment.isOwn), [true, false]);
});

test("uses only the WeChat bill preamble to establish a declared range", () => {
  const header = "交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态";
  const row = "2025-01-01 00:00:00,转账,甲,开始2025-01-01 结束2025-12-31 23:59:59,支出,10,支付成功";
  const data = parseImport("bill.csv", `${header}\n${row}`);
  assert.deepEqual(data.coverageRanges.payments, []);
  assert.equal(coverage(data, 2025).payments.level, "partial");
});

test("validates date-only bill ranges and skips malformed amounts", () => {
  const header = "交易时间,交易类型,交易对方,商品,收/支,金额(元),当前状态";
  const dates = "起始时间：[2025-01-01] 终止时间：[2025-12-31]";
  const row = '2025-06-01 00:00:00,转账,甲,测试,支出,"￥1,234.50",支付成功';
  const valid = parseImport("bill.csv", `${dates}\n${header}\n${row}`);
  assert.equal(coverage(valid, 2025).payments.level, "complete");
  assert.equal(analyze(valid, 2025).transferSentAmount, "1234.50");
  const malformed = parseImport("bill.csv", `${dates}\n${header}\n${row}\n${row.replace('"￥1,234.50"', "金额缺失")}`);
  assert.equal(malformed.diagnostics[0].skipped, 1);
  assert.equal(coverage(malformed, 2025).payments.level, "partial");
  assert.equal(analyze(malformed, 2025).transferSentCount, 1);
  const backup = JSON.parse(serializeDataset(valid));
  backup.payments.push({ ...backup.payments[0], amount: "金额缺失" });
  const restored = parseImport("damaged-backup.json", JSON.stringify(backup));
  assert.equal(restored.diagnostics[0].skipped, 1);
  assert.equal(coverage(restored, 2025).payments.level, "partial");
});

test("preserves literal chat quotes and rejects a truncated quoted CSV field", () => {
  const header = "时间,类型,内容";
  const bare = '2025-06-01 12:00:00,文字,他说"你好"';
  const quoted = '2025-06-01 12:00:01,文字,"他说""你好"", 接着说再见"';
  const data = parseImport("chat.csv", `${header}\n${bare}\n${quoted}`);
  assert.deepEqual(data.messages.map((row) => row.content), ['他说"你好"', '他说"你好", 接着说再见']);
  assert.throws(() => parseImport("chat.csv", `${header}\n2025-06-01 12:00:00,文字,"未闭合`), /未闭合/);
});

test("reports all-invalid rows and accepts only text warnings from a backup", () => {
  const messages = [{ type: "text", content: "时间缺失" }];
  assert.throws(() => parseImport("chat.json", JSON.stringify({ messages })), /1 条已跳过/);
  const parsed = parseImport("backup.json", JSON.stringify({
    schemaVersion: "1.0",
    warnings: ["合成样例提醒", " ", null, { unexpected: "object" }],
  }));
  assert.deepEqual(parsed.warnings, ["合成样例提醒"]);
});
