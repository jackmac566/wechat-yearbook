// 真实微信链路验收辅助：核对一份真实导出的聊天转发包/TXT 与预期数字是否一致。
// 用法（在项目根目录）：
//   node scripts/verify-real-link.mjs <转发ZIP或聊天记录.txt> \
//     --self <你的昵称> --session <会话名> \
//     --year 2026 \
//     [--expect-sent 3] [--expect-received 3] [--expect-unknown 0] \
//     [--expect-text 2] [--expect-image 1] [--expect-sticker 1] [--expect-voice 1] \
//     [--expect-video 0] [--expect-file 0] [--expect-link 0]
// 类型预期只核对本人发出的消息。此脚本只验证解析与统计。
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { isChatArchive, parseImportArchive, parseImportText } from "../src/lib/import-file.js";
import { transcriptDataset } from "../src/lib/wechat-transcript.js";
import { analyze, availableYears } from "../src/lib/analytics.js";

function invalid(message) {
  console.error(message);
  console.error("用法：node scripts/verify-real-link.mjs <转发ZIP或聊天记录.txt> --self <昵称> --session <会话名> [--year 2026] [--expect-*]");
  process.exit(2);
}

const [filePath, ...args] = process.argv.slice(2);
if (!filePath || filePath.startsWith("--")) invalid("请先指定转发文件");
const statKeys = ["sent", "received", "unknown", "text", "image", "sticker", "voice", "video", "file", "link", "poke"];
const allowed = new Set(["self", "session", "year", ...statKeys.map((key) => `expect-${key}`)]);
const options = new Map();
for (let i = 0; i < args.length; i += 2) {
  const flag = args[i];
  const key = flag.slice(2);
  const value = args[i + 1];
  if (!flag.startsWith("--") || !allowed.has(key) || options.has(key) || !value?.trim() || value.startsWith("--")) {
    invalid(`参数无效或重复：${flag}`);
  }
  options.set(key, value);
}
const rawSelf = options.get("self");
if (!rawSelf) invalid("请指定 --self <昵称>，本批没有本人消息时指定 --self none");
const selfName = rawSelf === "none" ? null : rawSelf;
const session = options.get("session") ?? "真实链路测试会话";
const rawYear = options.get("year") ?? String(new Date().getFullYear());
if (!/^\d{4}$/.test(rawYear)) invalid("--year 需要四位年份");
const year = Number(rawYear);

const expectations = {};
for (const key of statKeys) {
  const value = options.get(`expect-${key}`);
  if (value === undefined) continue;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) invalid(`--expect-${key} 需要非负整数`);
  expectations[key] = Number(value);
}

const buffer = readFileSync(filePath);
const fakeFile = new File([buffer], basename(filePath), { type: "application/octet-stream" });
const imported = isChatArchive(fakeFile.name)
  ? await parseImportArchive(fakeFile, () => {})
  : await parseImportText(fakeFile.name, await fakeFile.text());
if (!imported.transcript) {
  console.error("没有识别到微信合并转发格式，请确认传入的是原始转发 ZIP 或 聊天记录.txt");
  process.exit(2);
}
if (selfName !== null && imported.transcript.senders.some(({ name }) => name === selfName) === false) {
  console.error(`昵称「${selfName}」不在导出记录里。文件中的发送人：${imported.transcript.senders.map(({ name, count }) => `${name}(${count})`).join("、")}。本批没有本人消息时请用 --self none`);
  process.exit(2);
}
const dataset = transcriptDataset(fakeFile.name, imported.transcript, selfName, session);
const years = availableYears(dataset);
if (!years.includes(year)) invalid(`文件没有 ${year} 年的记录，可核对的年份：${years.join("、") || "无"}`);
const stats = analyze(dataset, year);

const actual = {
  sent: stats.sent,
  received: stats.received,
  unknown: stats.directionUnknown,
  text: stats.typeCounts.text || 0,
  image: stats.typeCounts.image || 0,
  sticker: stats.typeCounts.sticker || 0,
  voice: stats.typeCounts.voice || 0,
  video: stats.typeCounts.video || 0,
  file: stats.typeCounts.file || 0,
  link: stats.typeCounts.link || 0,
  poke: stats.typeCounts.poke || 0,
};
console.log(`文件：${fakeFile.name}`);
console.log(`识别发送人：${imported.transcript.senders.map(({ name, count }) => `${name}(${count})`).join("、")}；共 ${imported.transcript.records.length} 条记录，跳过 ${imported.transcript.skipped} 条`);
console.log(`${year} 年统计 → 发出 ${actual.sent} · 收到 ${actual.received} · 方向未知 ${actual.unknown}`);
if (Object.keys(expectations).length) {
  console.log(`本人发出的类型 → 文字 ${actual.text} · 图片 ${actual.image} · 表情 ${actual.sticker} · 语音 ${actual.voice} · 视频 ${actual.video} · 文件 ${actual.file} · 链接 ${actual.link} · 拍一拍 ${actual.poke}`);
}

let failed = false;
for (const [key, expected] of Object.entries(expectations)) {
  const ok = actual[key] === expected;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} expect-${key}: 期望 ${expected}，实际 ${actual[key]}`);
}
if (!Object.keys(expectations).length) console.log("未提供 --expect-*，仅输出实际统计。");
process.exit(failed ? 1 : 0);
