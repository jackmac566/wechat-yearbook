import { APP_NAME, APP_VERSION, DATA_SCHEMA_VERSION } from "../version.js";
import { coverage, localYearStart } from "./analytics.js";

const iso = (value) => value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
const inYear = (item, year) => year === null || item.date?.getFullYear() === year;
const kinds = ["messages", "payments", "moments"];

function serializeRanges(coverageRanges = {}, year) {
  const yearStart = year === null ? -Infinity : localYearStart(year).getTime();
  const yearEnd = year === null ? Infinity : localYearStart(year + 1).getTime() - 1;
  return Object.fromEntries(kinds.map((kind) => [kind, (coverageRanges[kind] || []).flatMap((range) => {
    const start = Math.max(range.start?.getTime(), yearStart);
    const end = Math.min(range.end?.getTime(), yearEnd);
    return start <= end ? [{ start: iso(new Date(start)), end: iso(new Date(end)), declared: range.declared === true }] : [];
  })]));
}

export function serializeDataset(dataset, options = {}) {
  const year = options.year === undefined ? null : Number(String(options.year).trim() || NaN);
  if (year !== null && !Number.isSafeInteger(year)) {
    throw new RangeError("导出年份必须是整数");
  }
  const selectedCoverage = year === null ? null : coverage(dataset, year);
  return JSON.stringify({
    schemaVersion: DATA_SCHEMA_VERSION,
    generator: `${APP_NAME} ${APP_VERSION}`,
    exportedAt: new Date().toISOString(),
    scope: year === null ? { type: "all_years" } : { type: "year", year },
    source: dataset.source || "本地导入",
    confidence: selectedCoverage
      ? Object.fromEntries(kinds.map((kind) => [kind, selectedCoverage[kind].hasYear ? selectedCoverage[kind].level : "missing"]))
      : dataset.confidence || {},
    coverageRanges: serializeRanges(dataset.coverageRanges, year),
    warnings: year === null ? dataset.warnings || [] : [],
    messages: (dataset.messages || []).filter((item) => inYear(item, year)).map((item) => ({
      id: item.id || "",
      time: iso(item.date),
      isSend: typeof item.isSend === "boolean" ? item.isSend : null,
      type: item.type || "text",
      content: item.content || "",
      contact: item.contact || "未知会话",
      duration: Number(item.duration || 0),
      isOwnRevoke: Boolean(item.isOwnRevoke),
      deletedMarker: Boolean(item.deletedMarker),
      ...(item.sourceFormat === "wechat-transcript" ? { sourceFormat: item.sourceFormat, sender: item.sender, fragmentRef: item.fragmentRef || undefined } : {}),
    })),
    payments: (dataset.payments || []).filter((item) => inYear(item, year)).map((item) => ({
      id: item.id || "",
      time: iso(item.date),
      type: item.type || "other",
      direction: item.direction || "other",
      amount: Number(item.amount || 0),
      counterparty: item.counterparty || "未知",
      status: item.status || "",
      note: item.note || "",
    })),
    moments: (dataset.moments || []).filter((item) => inYear(item, year)).map((item) => ({
      id: item.id || "",
      time: iso(item.date),
      type: item.kind || "post",
      isOwn: item.ownershipKnown === false ? undefined : Boolean(item.isOwn),
      content: item.content || "",
    })),
  }, null, 2);
}
