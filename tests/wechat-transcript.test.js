import assert from "node:assert/strict";
import test from "node:test";
import { analyze, availableYears, coverage } from "../src/lib/analytics.js";
import { serializeDataset } from "../src/lib/export.js";
import { parseImportText } from "../src/lib/import-file.js";
import { mergeDatasets, parseImport } from "../src/lib/parser.js";
import { parseWeChatTranscript, transcriptDataset } from "../src/lib/wechat-transcript.js";

// Synthetic cases based on the record layout and attachment markers documented by
// https://github.com/qzz0518/Dukou/tree/v0.1.19/Tests/DukouCoreTests
const block = (sender, time, text) => `·${sender}\n${time}\n${text}\n`;
const march = "2025年3月8日 09:10";

test("recognizes native records in UTF-8 text with a BOM and CRLF", () => {
  const body = [
    block("  昵称 A  ", march, "第一行\n  第二行\n·这是正文列表项"),
    block("合成昵称 B", "2025年12月31日 23:59", "[图片] 图片_1.jpg"),
    block("  昵称 A  ", "2026年1月1日 00:00", "新年"),
  ].join("\n");
  const result = parseWeChatTranscript(`\uFEFF\n${body.replace(/\n/g, "\r\n")}`);
  assert.deepEqual(result.senders, [{ name: "  昵称 A  ", count: 2 }, { name: "合成昵称 B", count: 1 }]);
  assert.deepEqual(result.records.map(({ content, type, date }) => [content, type, date]), [
    ["第一行\n  第二行\n·这是正文列表项", "text", new Date(2025, 2, 8, 9, 10)],
    ["[图片] 图片_1.jpg", "image", new Date(2025, 11, 31, 23, 59)],
    ["新年", "text", new Date(2026, 0, 1, 0, 0)],
  ]);
  assert.equal(result.skipped, 0);
});

test("handles only recognized transcripts and counts malformed records", () => {
  assert.equal(parseWeChatTranscript("时间,发送者,内容\n2026-08-20,我,测试"), null);
  assert.equal(parseWeChatTranscript("普通文字\n·不是记录\n今天"), null);
  assert.equal(parseWeChatTranscript("·列表项\n非导出时间"), null);
  assert.throws(() => parseWeChatTranscript(block("甲", "2025年2月29日 12:00", "非法日期")), /没有可用消息/);
  const result = parseWeChatTranscript([
    block("甲", march, "合法消息"),
    block("错误者", "2025年3月8日 24:00", "时间无效"),
    block(" ", march, "昵称无效"),
    block("乙", march, "另一条合法消息"),
    "·缺失正文\n2025年3月8日 09:12",
  ].join("\n"));
  assert.deepEqual(result.records.map(({ content }) => content), ["合法消息", "另一条合法消息"]);
  assert.equal(result.skipped, 3);
});

test("keeps a forwarded transcript in its outer message and respects whole media tokens", () => {
  const nested = "[聊天记录]\n\n    ·内层发言人\n    2025年3月8日 09:01\n    内层内容";
  const contents = [
    nested, "[图片]图片_1.jpg", "[文件] 截图.png", "[動画]", "[视频号] 标题",
    "[图片] 我指的是图片的大小", "[動畫]", "[动画表情]", "videos/clip.mp4", "[語音] recording.amr",
  ];
  const result = parseWeChatTranscript(contents.map((content) => block("甲", march, content)).join("\n"));
  assert.deepEqual(result.records.map(({ content }) => content), contents);
  assert.deepEqual(result.records.map(({ type }) => type), [
    "link", "image", "file", "text", "text", "text", "text", "sticker", "video", "voice",
  ]);
  assert.deepEqual(result.senders, [{ name: "甲", count: 10 }]);
});

test("requires explicit identity and conversation, preserves repeats and uses observed years only", () => {
  const result = parseWeChatTranscript([
    block("乙", "2023年12月31日 23:58", "收到"),
    block("甲 ", march, "重复"),
    block("甲 ", march, "重复"),
    block("乙", march, "重复"),
  ].join("\n"));
  for (const value of [undefined, "", "甲", "不存在"]) {
    assert.throws(() => transcriptDataset("记录.txt", result, value, "测试会话"), /本人昵称/);
  }
  assert.throws(() => transcriptDataset("记录.txt", result, "甲 ", " "), /会话名称/);
  const dataset = transcriptDataset("记录.txt", result, "甲 ", "测试会话");
  assert.deepEqual(dataset.messages.map(({ sender, isSend }) => [sender, isSend]), [
    ["乙", false], ["甲 ", true], ["甲 ", true], ["乙", false],
  ]);
  assert(dataset.messages.every((item) => item.contact === "测试会话" && item.id === "" && item.sourceFormat === "wechat-transcript"));
  assert.deepEqual(availableYears(dataset), [2025, 2023]);
  assert.deepEqual(coverage(dataset, 2024).messages, { level: "out_of_year", hasYear: false });
  assert.deepEqual(coverage(dataset, 2025).messages, { level: "partial", hasYear: true, hasFragments: true });
  assert.equal(analyze(dataset, 2025).sent, 2);
  assert.equal(analyze(dataset, 2025).received, 1);
  assert.equal(dataset.diagnostics[0].parsed, 4);
  assert(transcriptDataset("记录.txt", result, null, "测试会话").messages.every(({ isSend }) => !isSend));
});

test("preserves fragment origin, and only merges the same fragment, including a backup", async () => {
  const body = [
    block("甲", march, "同分钟同文"),
    block("乙", march, "同分钟同文"),
    block("丙", march, "同分钟同文"),
  ].join("\n");
  const { transcript } = await parseImportText("记录.txt", body);
  const file = transcriptDataset("记录.txt", transcript, "甲", "会话");
  const restored = parseImport("backup.json", serializeDataset(file, { year: 2025 }));
  assert.deepEqual(restored.messages.map(({ sender }) => sender), ["甲", "乙", "丙"]);
  assert.equal(coverage(restored, 2025).messages.hasFragments, true);
  assert.equal(mergeDatasets(file, restored).messages.length, 3);
  const nextBody = block("甲", march, "同分钟同文") + block("乙", march, "这是另一批");
  const next = (await parseImportText("另一批.txt", nextBody)).transcript;
  const merged = mergeDatasets(file, transcriptDataset("另一批.txt", next, "甲", "会话"));
  assert.equal(merged.messages.length, 5);
  assert.equal(analyze(merged, 2025).sent, 2);
  assert.equal(coverage({ ...merged, confidence: { messages: "complete" } }, 2025).messages.level, "partial");
});

test("reports native red packet markers without creating payments or duplicating old backups", async () => {
  const body = [
    block("甲", march, "[微信红包] 合成祝福"),
    block("甲", march, "[微信红包] 合成祝福"),
    block("乙", march, "[微信红包] 群红包"),
    block("乙", march, "正文提到 [微信红包]"),
    block("乙", march, "[微信红包] 引用\n下一行说明"),
  ].join("\n");
  const { transcript } = await parseImportText("聊天记录.txt", body);
  const chat = transcriptDataset("聊天记录.txt", transcript, "甲", "合成群聊");
  assert(chat.messages.every(({ type }) => type === "text"), "preserves the types that form V0.5.1 fragment IDs");
  const oldBackup = parseImport("旧备份.json", serializeDataset(chat));
  const restored = mergeDatasets(oldBackup, chat);
  assert.equal(restored.messages.length, 5);
  const chatOnly = analyze(restored, 2025);
  assert.deepEqual(chatOnly.chatRedPackets, { sent: 2, received: 1, unknown: 0 });
  assert.equal(chatOnly.typeCounts.red_packet, 2);
  assert.equal(chatOnly.redSentCount, 0);
  assert.equal(chatOnly.redReceivedCount, 0);
  assert.equal(coverage(restored, 2025).payments.hasYear, false);

  const bill = parseImport("微信支付账单.csv", [
    "交易时间,交易类型,交易对方,收/支,金额(元),当前状态,交易单号",
    "2025-03-08 09:10:32,微信红包,合成对象,支出,8.88,支付成功,bill-01",
    "2025-03-08 09:11:12,微信红包,合成对象,收入,2.00,已存入零钱,bill-02",
    "2025-03-08 09:12:14,微信红包,合成对象,支出,1.00,已退款,bill-03",
  ].join("\n"));
  const withBill = analyze(mergeDatasets(restored, bill), 2025);
  assert.deepEqual(withBill.chatRedPackets, chatOnly.chatRedPackets);
  assert.equal(withBill.redSentCount, 1);
  assert.equal(withBill.redSentAmount, "8.88");
  assert.equal(withBill.redReceivedCount, 1);
  assert.deepEqual(withBill.sentRedPacketPayments.map(({ id, amount }) => [id, amount]), [["bill-01", 8.88]]);
});
