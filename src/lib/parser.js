import { parseCSV, rowsToObjects } from "./csv.js";

const first = (object, keys, fallback = "") => {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null && object[key] !== "") return object[key];
  }
  return fallback;
};

const toBool = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 || value === 3;
  return ["1", "3", "true", "yes", "y", "sent", "send", "发送", "是", "自己", "我", "me"].includes(String(value).trim().toLowerCase());
};

const toDate = (value) => {
  if (value instanceof Date) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{10}$/.test(raw)) return new Date(Number(raw) * 1000);
  if (/^\d{13}$/.test(raw)) return new Date(Number(raw));
  const normalized = raw.replace(/年|月/g, "-").replace(/日/g, "").replace(/\//g, "-");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hasOwn = (object, keys) => keys.some((key) => Object.prototype.hasOwnProperty.call(object || {}, key) && object[key] !== "");

const dateKeys = ["time", "Time", "createTime", "CreateTime", "create_time", "msgCreateTime", "MsgCreateTime", "timestamp", "Timestamp", "日期", "时间", "发送时间"];
const messageChildKeys = ["messages", "Messages", "records", "Records", "messageList", "MessageList", "chatRecords", "ChatRecords", "list", "List"];
const sessionChildKeys = ["sessions", "Sessions", "sessionList", "SessionList", "chats", "Chats"];

const warningForSkipped = (kind, skipped) => skipped > 0 ? [`${kind}已跳过 ${skipped} 条时间或字段无效的记录。`] : [];

const asArray = (value) => Array.isArray(value) ? value : [];

const normalizeRanges = (ranges = {}) => Object.fromEntries(
  ["messages", "payments", "moments"].map((kind) => [kind, asArray(ranges[kind]).map((range) => ({
    start: toDate(range?.start),
    end: toDate(range?.end),
    declared: Boolean(range?.declared),
  })).filter((range) => range.start && range.end)]),
);

const typeFrom = (value, content = "") => {
  const raw = String(value ?? "").toLowerCase();
  const text = `${raw} ${content}`.toLowerCase();
  if (/撤回|revokemsg|revoke/.test(text)) return "revoke";
  if (/转账|transfer/.test(text)) return "transfer";
  if (/红包|red.?packet|hongbao/.test(text)) return "red_packet";
  if (/拍一拍|pat/.test(text)) return "poke";
  if (/通话|voip|call/.test(text)) return "call";
  if (["50"].includes(raw)) return "call";
  if (["3", "image", "图片"].includes(raw)) return "image";
  if (["34", "voice", "语音"].includes(raw)) return "voice";
  if (["43", "video", "视频"].includes(raw)) return "video";
  if (["47", "sticker", "emoji", "表情"].includes(raw)) return "sticker";
  if (["48", "location", "位置"].includes(raw)) return "location";
  if (["49", "link", "file", "app", "分享", "文件"].includes(raw)) {
    if (/\.pdf|\.doc|\.xls|\.zip|文件/.test(text)) return "file";
    return "link";
  }
  if (["10000", "10002", "system", "系统", "系统提示", "撤回消息"].includes(raw)) return raw === "10002" || /撤回/.test(text) ? "revoke" : "system";
  return "text";
};

function normalizeMessage(row, fallbackContact = "未知会话") {
  const content = String(first(row, ["content", "Content", "msgContent", "MsgContent", "StrContent", "strContent", "message", "文本", "内容"], ""));
  const rawType = first(row, ["type", "Type", "messageType", "MessageType", "msgType", "MsgType", "类型", "消息类型"], "");
  const date = toDate(first(row, dateKeys));
  if (!date) return null;
  const isSendValue = first(row, ["isSend", "IsSend", "isSender", "IsSender", "is_send", "fromMe", "FromMe", "from_me", "msgStatus", "方向", "是否发送", "sender", "Sender", "发送者"], false);
  const isSend = toBool(isSendValue);
  const sender = String(first(row, ["sender", "Sender", "senderName", "SenderName", "发送者"], ""));
  const explicitContact = first(row, ["contact", "Contact", "talker", "Talker", "StrTalker", "nickname", "NickName", "remark", "Remark", "sessionName", "SessionName", "会话", "联系人", "群聊"], "");
  const isOwnRevoke = toBool(first(row, ["isOwnRevoke", "IsOwnRevoke"], false)) || /你撤回|you recalled|我撤回/.test(content.toLowerCase()) || (typeFrom(rawType, content) === "revoke" && toBool(isSendValue));
  return {
    id: String(first(row, ["id", "ID", "mesLocalID", "MesLocalID", "mesMesSvrID", "MesSvrID", "MsgLocalID", "MsgSvrID", "localId", "LocalId", "serverId", "ServerId", "server_id", "消息ID"], "")),
    date,
    isSend,
    type: typeFrom(rawType, content),
    content,
    contact: String(explicitContact || (!isSend && sender && sender !== "系统" ? sender : fallbackContact)),
    duration: Number(first(row, ["duration", "Duration", "voiceDuration", "VoiceDuration", "VoiceLength", "callDuration", "时长"], 0)) || 0,
    isOwnRevoke,
    deletedMarker: toBool(first(row, ["deletedMarker", "DeletedMarker", "deleted", "Deleted", "isDeleted", "IsDeleted", "is_deleted", "删除标记"], false)),
  };
}

const contactFromFileName = (name = "") => {
  const baseName = String(name).split(/[\\/]/).pop() || "";
  const label = baseName.replace(/\.(json|csv|txt)$/i, "").trim();
  return /^(chat|messages?|records?|聊天记录)$/i.test(label) || !label ? "当前导出会话" : label.replace(/[-_ ]?(chat|messages?|聊天记录)$/i, "") || "当前导出会话";
};

function normalizePayment(row) {
  const date = toDate(first(row, ["交易时间", "time", "Time", "date", "Date", "时间"]));
  if (!date) return null;
  const transactionType = String(first(row, ["交易类型", "type", "category", "类型"], "其他")).trim().toLowerCase();
  const direction = String(first(row, ["收/支", "方向", "direction", "incomeOrExpense"], ""));
  const amountRaw = String(first(row, ["金额(元)", "金额", "amount", "money"], "0"));
  const amount = Math.abs(Number((amountRaw.match(/-?[\d,.]+/)?.[0] || "0").replace(/,/g, "")));
  return {
    id: String(first(row, ["交易单号", "transactionId", "id", "订单号"], "")),
    date,
    type: /红包|red[_ -]?packet|hongbao/.test(transactionType) ? "red_packet" : /转账|transfer/.test(transactionType) ? "transfer" : "other",
    direction: /支出|^支$|out|send/i.test(direction) ? "out" : /收入|^收$|in|receive/i.test(direction) ? "in" : "other",
    amount: Number.isFinite(amount) ? amount : 0,
    counterparty: String(first(row, ["交易对方", "counterparty", "对方"], "未知")),
    status: String(first(row, ["当前状态", "状态", "status"], "")),
    note: String(first(row, ["商品", "商品说明", "备注", "note"], "")),
  };
}

function normalizeMoment(row) {
  const date = toDate(first(row, ["time", "Time", "date", "Date", "createTime", "CreateTime", "时间", "发表时间"]));
  if (!date) return null;
  const content = String(first(row, ["content", "Content", "text", "Text", "内容"], ""));
  const rawType = String(first(row, ["type", "Type", "kind", "Kind", "类型"], "post")).toLowerCase();
  const ownershipKeys = ["isOwn", "IsOwn", "is_own", "isMe", "IsMe", "self", "Self", "fromMe", "FromMe", "sender", "Sender", "author", "Author", "是否本人", "发表者"];
  const ownershipKnown = hasOwn(row, ownershipKeys);
  return {
    id: String(first(row, ["id", "ID", "snsId", "SnsId", "momentId", "MomentId", "动态ID"], "")),
    date,
    kind: /comment|评论/.test(rawType) ? "comment" : /like|赞/.test(rawType) ? "like" : "post",
    isOwn: ownershipKnown ? toBool(first(row, ownershipKeys, false)) : false,
    ownershipKnown,
    content,
  };
}

function findHeader(rows, required) {
  return rows.findIndex((row) => required.some((name) => row.some((cell) => cell.includes(name))));
}

function parseBillRange(text) {
  const relevant = String(text).split(/\r?\n/).filter((line) => /起始|开始|终止|结束|时间范围|账单周期/.test(line)).join(" ");
  const matches = relevant.match(/\d{4}(?:[-/年])\d{1,2}(?:[-/月])\d{1,2}(?:日)?(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?/g) || [];
  if (matches.length < 2) return null;
  const start = toDate(matches[0]);
  const end = toDate(matches[matches.length - 1]);
  return start && end && start <= end ? { start, end, declared: true } : null;
}

function rangeCoversFullCalendarYear(range) {
  if (!range?.start || !range?.end) return false;
  const year = range.start.getFullYear();
  const startDay = new Date(year, 0, 1).setHours(0, 0, 0, 0);
  const endDay = new Date(year, 11, 31).setHours(0, 0, 0, 0);
  const rangeStart = new Date(range.start).setHours(0, 0, 0, 0);
  const rangeEnd = new Date(range.end).setHours(0, 0, 0, 0);
  return range.end.getFullYear() === year && rangeStart <= startDay && rangeEnd >= endDay;
}

function buildResult({ source, name, kind, messages = [], payments = [], moments = [], confidence, warnings = [], skipped = 0, coverageRanges = {} }) {
  return {
    source,
    messages,
    payments,
    moments,
    confidence,
    coverageRanges: normalizeRanges(coverageRanges),
    diagnostics: [{ file: String(name), kind, parsed: messages.length + payments.length + moments.length, skipped }],
    warnings: [...warnings, ...warningForSkipped(kind, skipped)],
  };
}

function parseCsvImport(text, name) {
  const rows = parseCSV(text);
  const paymentHeader = findHeader(rows, ["交易时间", "交易类型", "交易对方", "金额(元)"]);
  if (paymentHeader >= 0 && rows[paymentHeader].some((cell) => cell.includes("交易时间"))) {
    const objects = rowsToObjects(rows, paymentHeader);
    const payments = objects.map(normalizePayment).filter(Boolean);
    const range = parseBillRange(text);
    return buildResult({
      source: "微信支付账单 CSV", name, kind: "支付账单", payments,
      confidence: { payments: rangeCoversFullCalendarYear(range) ? "complete" : "partial", messages: "missing", moments: "missing" },
      coverageRanges: { payments: range ? [range] : [] },
      warnings: payments.length ? (range ? [] : ["账单未声明起止日期，不能确认是否覆盖完整年份。"] ) : ["账单中没有识别到有效交易记录。"],
      skipped: objects.length - payments.length,
    });
  }

  const headerIndex = findHeader(rows, ["msgCreateTime", "MsgCreateTime", "CreateTime", "isSend", "IsSender", "消息类型", "发送时间", "content", "StrContent", "发送者"]);
  if (headerIndex < 0) throw new Error("没有识别到受支持的 CSV 表头");
  const objects = rowsToObjects(rows, headerIndex);
  const looksMoments = rows[headerIndex].some((cell) => /朋友圈|moment|isOwn|IsOwn|is_own|是否本人/.test(cell));
  if (looksMoments) {
    const moments = objects.map(normalizeMoment).filter(Boolean);
    const unknownOwnership = moments.filter((item) => !item.ownershipKnown).length;
    return buildResult({
      source: "朋友圈 CSV", name, kind: "朋友圈", moments,
      confidence: { moments: "partial", messages: "missing", payments: "missing" },
      warnings: unknownOwnership ? [`朋友圈有 ${unknownOwnership} 条记录没有本人归属字段，未计入个人发表、评论或点赞。`] : [],
      skipped: objects.length - moments.length,
    });
  }
  const fallbackContact = contactFromFileName(name);
  const messages = objects.map((row) => normalizeMessage(row, fallbackContact)).filter(Boolean);
  return buildResult({
    source: "聊天记录 CSV", name, kind: "聊天记录", messages,
    confidence: { messages: "partial", payments: "missing", moments: "missing" },
    skipped: objects.length - messages.length,
  });
}

function parseJsonImport(text, name) {
  const raw = JSON.parse(text);
  const root = Array.isArray(raw) ? { messages: raw } : raw;
  const fallbackContact = contactFromFileName(name);
  const messageRows = [];
  const visitMessages = (value, inheritedContact = fallbackContact, depth = 0) => {
    if (!value || depth > 16) return;
    if (Array.isArray(value)) {
      value.forEach((item) => visitMessages(item, inheritedContact, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const contact = String(first(value, ["contact", "Contact", "talker", "Talker", "nickname", "NickName", "remark", "Remark", "name", "Name", "sessionName", "SessionName"], inheritedContact));
    const hasTime = first(value, dateKeys, null) !== null;
    const hasMessageShape = hasOwn(value, ["content", "Content", "msgContent", "MsgContent", "StrContent", "strContent", "message", "文本", "内容", "type", "Type", "messageType", "MessageType", "msgType", "MsgType", "isSend", "IsSend", "isSender", "IsSender", "sender", "Sender", "MsgSvrID", "server_id"]);
    if (hasTime && hasMessageShape) {
      messageRows.push([value, contact || inheritedContact]);
    }
    messageChildKeys.forEach((key) => visitMessages(value[key], contact || inheritedContact, depth + 1));
    sessionChildKeys.forEach((key) => visitMessages(value[key], contact || inheritedContact, depth + 1));
  };
  [...messageChildKeys, ...sessionChildKeys].forEach((key) => visitMessages(root?.[key]));
  const rawDataRoot = root?.data ?? root?.Data;
  if (rawDataRoot && typeof rawDataRoot === "object") visitMessages(rawDataRoot);
  const messages = messageRows.map(([row, contact]) => normalizeMessage(row, contact)).filter(Boolean);
  const dataRoot = rawDataRoot && !Array.isArray(rawDataRoot) ? rawDataRoot : {};
  const paymentRows = asArray(root.payments || root.Payments || root.bills || root.Bills || dataRoot.payments || dataRoot.Payments || dataRoot.bills || dataRoot.Bills);
  const momentRows = asArray(root.moments || root.Moments || root.timeline || root.Timeline || dataRoot.moments || dataRoot.Moments || dataRoot.timeline || dataRoot.Timeline);
  const payments = paymentRows.map(normalizePayment).filter(Boolean);
  const moments = momentRows.map(normalizeMoment).filter(Boolean);
  if (!messages.length && !payments.length && !moments.length && !root.schemaVersion) throw new Error("JSON 中没有识别到 messages、payments 或 moments 数据");
  const importedConfidence = root.confidence || {};
  const unknownOwnership = moments.filter((item) => !item.ownershipKnown).length;
  const skipped = messageRows.length - messages.length + paymentRows.length - payments.length + momentRows.length - moments.length;
  return buildResult({
    source: root.schemaVersion ? "微信年轮标准 JSON" : "兼容结构化 JSON", name,
    kind: root.schemaVersion ? "标准备份" : "结构化数据", messages, payments, moments,
    confidence: {
      messages: messages.length ? importedConfidence.messages || "partial" : "missing",
      payments: payments.length ? importedConfidence.payments || "partial" : "missing",
      moments: moments.length ? importedConfidence.moments || "partial" : "missing",
    },
    coverageRanges: root.coverageRanges || {},
    warnings: [...asArray(root.warnings), ...(unknownOwnership ? [`朋友圈有 ${unknownOwnership} 条记录没有本人归属字段，未计入个人发表、评论或点赞。`] : [])],
    skipped,
  });
}

export function parseImport(name, text) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) return parseJsonImport(text, name);
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return parseCsvImport(text, name);
  throw new Error("当前支持 CSV、JSON 和 TXT 文本文件");
}

export function mergeDatasets(current, incoming) {
  const dedupe = (items, key) => Array.from(new Map(items.map((item) => [key(item), item])).values());
  const confidenceRank = { missing: 0, partial: 1, complete: 2 };
  const strongest = (left = "missing", right = "missing") => confidenceRank[right] > confidenceRank[left] ? right : left;
  const diagnostics = [...(current.diagnostics || []), ...(incoming.diagnostics || [])];
  const sources = [...new Set([current.source, incoming.source].filter((source) => source && source !== "演示数据" && source !== "尚未导入"))];
  return {
    source: diagnostics.length > 3 ? `已合并 ${diagnostics.length} 个文件` : sources.join(" + ") || incoming.source,
    messages: dedupe([...(current.messages || []), ...(incoming.messages || [])], (x) => x.id ? `id:${x.contact}|${x.id}` : `${x.date.getTime()}|${x.contact}|${x.type}|${x.content}`),
    payments: dedupe([...(current.payments || []), ...(incoming.payments || [])], (x) => x.id ? `id:${x.id}` : `${x.date.getTime()}|${x.type}|${x.amount}|${x.counterparty}`),
    moments: dedupe([...(current.moments || []), ...(incoming.moments || [])], (x) => x.id ? `id:${x.id}` : `${x.date.getTime()}|${x.kind}|${x.content}`),
    confidence: {
      messages: strongest(current.confidence?.messages, incoming.confidence?.messages),
      payments: strongest(current.confidence?.payments, incoming.confidence?.payments),
      moments: strongest(current.confidence?.moments, incoming.confidence?.moments),
    },
    coverageRanges: {
      messages: [...(current.coverageRanges?.messages || []), ...(incoming.coverageRanges?.messages || [])],
      payments: [...(current.coverageRanges?.payments || []), ...(incoming.coverageRanges?.payments || [])],
      moments: [...(current.coverageRanges?.moments || []), ...(incoming.coverageRanges?.moments || [])],
    },
    diagnostics,
    warnings: [...new Set([...(current.warnings || []), ...(incoming.warnings || [])])],
  };
}
