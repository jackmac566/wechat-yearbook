import { APP_NAME, APP_VERSION, DATA_SCHEMA_VERSION } from "../version.js";

const iso = (value) => value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
const inYear = (item, year) => !year || item.date?.getFullYear() === Number(year);

const serializeRanges = (coverageRanges = {}, year) => Object.fromEntries(
  ["messages", "payments", "moments"].map((kind) => [kind, (coverageRanges[kind] || [])
    .filter((range) => !year || (range.start?.getFullYear() <= Number(year) && range.end?.getFullYear() >= Number(year)))
    .map((range) => ({ start: iso(range.start), end: iso(range.end), declared: Boolean(range.declared) }))]),
);

export function serializeDataset(dataset, options = {}) {
  const year = options.year !== undefined && Number.isInteger(Number(options.year)) ? Number(options.year) : null;
  return JSON.stringify({
    schemaVersion: DATA_SCHEMA_VERSION,
    generator: `${APP_NAME} ${APP_VERSION}`,
    exportedAt: new Date().toISOString(),
    scope: year ? { type: "year", year } : { type: "all_years" },
    source: dataset.source || "本地导入",
    confidence: dataset.confidence || {},
    coverageRanges: serializeRanges(dataset.coverageRanges, year),
    warnings: dataset.warnings || [],
    messages: (dataset.messages || []).filter((item) => inYear(item, year)).map((item) => ({
      id: item.id || "",
      time: iso(item.date),
      isSend: Boolean(item.isSend),
      type: item.type || "text",
      content: item.content || "",
      contact: item.contact || "未知会话",
      duration: Number(item.duration || 0),
      isOwnRevoke: Boolean(item.isOwnRevoke),
      deletedMarker: Boolean(item.deletedMarker),
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
      isOwn: Boolean(item.isOwn),
      content: item.content || "",
    })),
  }, null, 2);
}
