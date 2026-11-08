import assert from "node:assert/strict";
import test from "node:test";
import { availableYears, coverage } from "../src/lib/analytics.js";
import { serializeDataset } from "../src/lib/export.js";
import { parseImport } from "../src/lib/parser.js";

const billRange = (start, end, declared = true) => ({ start: new Date(start), end: new Date(end), declared });

test("payment coverage requires a valid declaration even when the source says complete", () => {
  const data = {
    confidence: { payments: "complete" },
    payments: [{ date: new Date(2025, 5, 1) }],
    coverageRanges: { payments: [billRange("2025-01-01T00:00:00", "2025-12-31T23:59:59", false)] },
  };
  assert.deepEqual(coverage(data, 2025).payments, { level: "partial", hasYear: true });
  data.coverageRanges.payments = [];
  assert.deepEqual(coverage(data, 2025).payments, { level: "partial", hasYear: true });
});

test("does not treat timestamp gaps on adjacent bill dates as complete", () => {
  const ranges = [
    billRange("2025-01-01T00:00:00", "2025-06-30T12:00:00"),
    billRange("2025-07-01T12:00:00", "2025-12-31T23:59:59"),
  ];
  const data = { coverageRanges: { payments: ranges } };
  assert.deepEqual(coverage(data, 2025).payments, { level: "partial", hasYear: true });
  ranges[0].end = new Date("2025-06-30T23:59:59");
  ranges[1].start = new Date("2025-07-01T00:00:00");
  assert.deepEqual(coverage(data, 2025).payments, { level: "complete", hasYear: true });
  ranges[0].start = new Date("2025-01-01T09:00:00");
  assert.deepEqual(coverage(data, 2025).payments, { level: "partial", hasYear: true });
});

test("single-year exports retain empty declared coverage only within the selected year", () => {
  const range = billRange("2024-01-01T00:00:00", "2026-12-31T23:59:59");
  const data = {
    coverageRanges: { payments: [range] },
    messages: [{ date: new Date(2024, 0, 2), content: "其它年份原文" }],
    warnings: ["其它年份导入提示"],
  };
  const backup = serializeDataset(data, { year: 2025 });
  const exported = JSON.parse(backup);
  assert.equal(exported.coverageRanges.payments[0].start, new Date(2025, 0, 1).toISOString());
  assert.equal(exported.coverageRanges.payments[0].end, new Date(new Date(2026, 0, 1).getTime() - 1).toISOString());
  assert.equal(exported.confidence.messages, "missing");
  assert.doesNotMatch(backup, /其它年份/);
  const restored = parseImport("yearbook.json", backup);
  assert.deepEqual(availableYears(restored), [2025]);
  assert.deepEqual(coverage(restored, 2025).payments, { level: "complete", hasYear: true });
  assert.deepEqual(availableYears(parseImport("yearbook.json", serializeDataset(data))), [2026, 2025, 2024]);
});

test("invalid year scope never defaults to all-year export", () => {
  assert.throws(() => serializeDataset({}, { year: "bad" }), RangeError);
  assert.throws(() => serializeDataset({}, { year: null }), RangeError);
});

test("preserves unknown ownership across a standard backup", () => {
  const data = parseImport("moments.json", JSON.stringify({ moments: [
    { time: "2025-01-01T12:00:00", type: "comment", content: "无归属字段" },
    { time: "2025-01-01T12:01:00", type: "comment", content: "明确为其他人", isOwn: false },
  ] }));
  const backup = serializeDataset(data, { year: 2025 });
  const restored = parseImport("yearbook.json", backup);
  assert.deepEqual(restored.moments.map((item) => [item.isOwn, item.ownershipKnown]), [[false, false], [false, true]]);
});
