import { APP_NAME, APP_VERSION, DATA_SCHEMA_VERSION } from "../version.js";

const iso = (value) => value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;

export function serializeDataset(dataset) {
  return JSON.stringify({
    schemaVersion: DATA_SCHEMA_VERSION,
    generator: `${APP_NAME} ${APP_VERSION}`,
    exportedAt: new Date().toISOString(),
    source: dataset.source || "本地导入",
    confidence: dataset.confidence || {},
    messages: (dataset.messages || []).map((item) => ({
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
    payments: (dataset.payments || []).map((item) => ({
      id: item.id || "",
      time: iso(item.date),
      type: item.type || "other",
      direction: item.direction || "other",
      amount: Number(item.amount || 0),
      counterparty: item.counterparty || "未知",
      status: item.status || "",
      note: item.note || "",
    })),
    moments: (dataset.moments || []).map((item) => ({
      id: item.id || "",
      time: iso(item.date),
      type: item.kind || "post",
      isOwn: Boolean(item.isOwn),
      content: item.content || "",
    })),
  }, null, 2);
}
