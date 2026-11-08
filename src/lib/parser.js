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
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    const localDate = new Date(0);
    localDate.setFullYear(year, month - 1, day);
    localDate.setHours(0, 0, 0, 0);
    return localDate.getMonth() === month - 1 && localDate.getDate() === day ? localDate : null;
  }
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hasOwn = (object, keys) => keys.some((key) => Object.hasOwn(object || {}, key) && object[key] != null && object[key] !== "");

const dateKeys = ["time", "Time", "createTime", "CreateTime", "create_time", "msgCreateTime", "MsgCreateTime", "timestamp", "Timestamp", "日期", "时间", "发送时间"];
const contentKeys = ["content", "Content", "msgContent", "MsgContent", "StrContent", "strContent", "message", "文本", "内容"];
const typeKeys = ["type", "Type", "messageType", "MessageType", "msgType", "MsgType", "类型", "消息类型"];
const senderKeys = ["sender", "Sender", "发送者"];
const senderNameKeys = [...senderKeys, "senderName", "SenderName"];
const directionKeys = ["isSend", "IsSend", "isSender", "IsSender", "is_send", "fromMe", "FromMe", "from_me", "msgStatus", "direction", "Direction", "方向", "是否发送"];
const messageIdKeys = ["id", "ID", "mesLocalID", "MesLocalID", "mesMesSvrID", "MesSvrID", "MsgLocalID", "MsgSvrID", "localId", "LocalId", "serverId", "ServerId", "server_id", "消息ID"];
const conversationKeys = ["contact", "Contact", "talker", "Talker", "StrTalker", "sessionName", "SessionName", "会话", "联系人", "群聊"];
const contactLabelKeys = ["nickname", "NickName", "remark", "Remark"];
const nameKeys = ["name", "Name"];
const sessionLabelKeys = [...conversationKeys, ...contactLabelKeys, ...nameKeys];
const revokeOwnerKeys = ["isOwnRevoke", "IsOwnRevoke"];
const messageFields = [...contentKeys, ...typeKeys, ...directionKeys, ...senderKeys];
const messageShapeKeys = [...messageFields, ...messageIdKeys, ...revokeOwnerKeys];
const messageChildKeys = ["messages", "Messages", "records", "Records", "messageList", "MessageList", "chatRecords", "ChatRecords", "list", "List", "sessions", "Sessions", "sessionList", "SessionList", "chats", "Chats"];
const momentOwnerFlags = ["isOwn", "IsOwn", "is_own", "isMe", "IsMe", "self", "Self", "是否本人"];

const sentDirections = new Set([true, 1, 3, "1", "3", "true", "yes", "y", "sent", "send", "out", "outgoing", "outbound", "发送", "发出", "是", "我", "自己", "本人", "me", "self"]);
const receivedDirections = new Set([false, 0, "0", "false", "no", "n", "received", "receive", "in", "incoming", "inbound", "收到", "接收", "否", "对方"]);
const selfSenderLabels = new Set(["我", "自己", "本人", "me", "self"]);
const otherSenderLabels = new Set(["对方", "其他人", "other"]);
const directionToken = (value) => typeof value === "string" ? value.trim().toLowerCase() : value;

function messageDirection(row, hasSelfSenderLabel) {
  for (const key of directionKeys) {
    if (!Object.hasOwn(row, key)) continue;
    const value = directionToken(row[key]);
    if (value === "") continue;
    if (sentDirections.has(value)) return true;
    if (receivedDirections.has(value)) return false;
    return null;
  }
  const sender = directionToken(first(row, senderKeys));
  if (selfSenderLabels.has(sender)) return true;
  if (otherSenderLabels.has(sender) || (hasSelfSenderLabel && typeof sender === "string" && sender && sender !== "系统")) return false;
  return null;
}

function usesSelfSenderLabel(row) {
  return row && selfSenderLabels.has(directionToken(first(row, senderKeys))) && messageDirection(row, false) === true;
}

const warningForSkipped = (kind, skipped) => skipped > 0 ? [`${kind}已跳过 ${skipped} 条时间或字段无效的记录。`] : [];

const asArray = (value) => Array.isArray(value) ? value : [];

const normalizeRanges = (ranges = {}) => Object.fromEntries(
  ["messages", "payments", "moments"].map((kind) => [kind, asArray(ranges?.[kind]).map((range) => ({
    start: toDate(range?.start),
    end: toDate(range?.end),
    declared: range?.declared === true,
  })).filter((range) => range.start && range.end && range.start <= range.end)]),
);

const ownRecallNotice = /^(?:(?:你|我)撤回了一条消息[。.]?(?:\s*重新编辑)?|you recalled a message[.!]?)$/i;
const explicitMessageTypes = new Map(Object.entries({
  text: ["1", "text", "文本", "文字"],
  revoke: ["revoke", "revokemsg", "撤回", "撤回消息"],
  transfer: ["transfer", "转账", "微信转账"],
  red_packet: ["red_packet", "redpacket", "red packet", "hongbao", "红包", "微信红包"],
  poke: ["poke", "pat", "拍一拍"],
  call: ["50", "call", "voip", "通话"],
  image: ["3", "image", "图片"],
  voice: ["34", "voice", "语音"],
  video: ["43", "video", "视频"],
  sticker: ["47", "sticker", "emoji", "表情"],
  location: ["48", "location", "位置"],
  file: ["file", "文件"],
  link: ["link", "分享"],
}).flatMap(([type, aliases]) => aliases.map((alias) => [alias, type])));

const typeFrom = (value, content) => {
  const raw = String(value ?? "").trim().toLowerCase();
  const explicit = explicitMessageTypes.get(raw);
  if (explicit) return explicit;
  const text = content.trim();
  if (["49", "app"].includes(raw)) {
    if (/^\[?(?:微信)?转账\]?$|<type>\s*2000\s*<\/type>/i.test(text)) return "transfer";
    if (/^\[?(?:微信)?红包\]?$|<type>\s*2001\s*<\/type>/i.test(text)) return "red_packet";
    if (/\.pdf|\.doc|\.xls|\.zip|文件|<type>\s*6\s*<\/type>/i.test(text)) return "file";
    return "link";
  }
  if (ownRecallNotice.test(text) || /<revokemsg[\s>]|^[“"][^”"\r\n]+[”"]撤回了一条消息[。.]?$/i.test(text)) return "revoke";
  if (/<(?:sysmsg\s+type=["']pat["']|pat[\s>])/i.test(text)) return "poke";
  if (["10000", "10002", "system", "系统", "系统提示"].includes(raw)) {
    if (/撤回了一条消息/.test(text)) return "revoke";
    if (/拍了拍|拍一拍/.test(text)) return "poke";
    return "system";
  }
  return "text";
};

function normalizeMessage(row, fallbackContact, sessionContact = "", hasSelfSenderLabel = false) {
  const content = String(first(row, contentKeys, ""));
  const date = toDate(first(row, dateKeys));
  if (!date) return null;
  const isSend = messageDirection(row, hasSelfSenderLabel);
  const sender = String(first(row, senderNameKeys));
  const explicitOwnRevoke = toBool(first(row, revokeOwnerKeys, false));
  const type = explicitOwnRevoke ? "revoke" : typeFrom(first(row, typeKeys), content);
  const otherSender = isSend !== true && sender !== "系统" ? sender : "";
  const contact = first(row, conversationKeys) || sessionContact || first(row, contactLabelKeys) || otherSender || first(row, nameKeys) || fallbackContact;
  const fragment = row.sourceFormat === "wechat-transcript";
  const fragmentRef = fragment && typeof row.fragmentRef === "string" && /^[a-f\d]{64}:\d+$/.test(row.fragmentRef) ? row.fragmentRef : "";
  return {
    id: String(first(row, messageIdKeys)),
    date,
    isSend,
    type,
    content,
    contact: String(contact),
    duration: Number(first(row, ["duration", "Duration", "voiceDuration", "VoiceDuration", "VoiceLength", "callDuration", "时长"], 0)) || 0,
    isOwnRevoke: type === "revoke" && (explicitOwnRevoke || ownRecallNotice.test(content.trim()) || isSend === true),
    deletedMarker: toBool(first(row, ["deletedMarker", "DeletedMarker", "deleted", "Deleted", "isDeleted", "IsDeleted", "is_deleted", "删除标记"], false)),
    ...(fragment ? { sourceFormat: row.sourceFormat, sender, fragmentRef } : {}),
  };
}

const contactFromFileName = (name = "") => {
  const baseName = String(name).split(/[\\/]/).pop() || "";
  const label = baseName.replace(/\.(json|csv|txt)$/i, "").trim();
  return /^(chat|messages?|records?|聊天记录)$/i.test(label) || !label ? "当前导出会话" : label.replace(/[-_ ]?(chat|messages?|聊天记录)$/i, "") || "当前导出会话";
};

const paymentAmountKeys = ["金额(元)", "金额（元）", "金额", "amount", "money"];

function normalizePayment(row) {
  const date = toDate(first(row, ["交易时间", "time", "Time", "date", "Date", "时间"]));
  if (!date) return null;
  const transactionType = String(first(row, ["交易类型", "type", "category", "类型"], "其他")).trim().toLowerCase();
  const direction = String(first(row, ["收/支", "方向", "direction", "incomeOrExpense"], ""));
  const amountRaw = first(row, paymentAmountKeys);
  const amountText = String(amountRaw).trim().replace(/^[¥￥]\s*/, "");
  const amount = typeof amountRaw === "number" ? Math.abs(amountRaw) : Math.abs(Number(amountText.replace(/,/g, "")));
  if (!Number.isFinite(amount) || (typeof amountRaw !== "number" && !/^-?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/.test(amountText))) return null;
  return {
    id: String(first(row, ["交易单号", "transactionId", "id", "订单号"], "")),
    date,
    type: /红包|red[_ -]?packet|hongbao/.test(transactionType) ? "red_packet" : /转账|transfer/.test(transactionType) ? "transfer" : "other",
    direction: /支出|^支$|out|send/i.test(direction) ? "out" : /收入|^收$|in|receive/i.test(direction) ? "in" : "other",
    amount,
    counterparty: String(first(row, ["交易对方", "counterparty", "对方"], "未知")),
    status: String(first(row, ["当前状态", "状态", "status"], "")),
    note: String(first(row, ["商品", "商品说明", "备注", "note"], "")),
  };
}

const momentDateKeys = ["time", "Time", "date", "Date", "createTime", "CreateTime", "时间", "发表时间"];
const momentOwnershipKeys = [...momentOwnerFlags, "fromMe", "FromMe", "sender", "Sender", "author", "Author", "发表者"];

function normalizeMoment(row) {
  const date = toDate(first(row, momentDateKeys));
  if (!date) return null;
  const content = String(first(row, ["content", "Content", "text", "Text", "内容"], ""));
  const rawType = String(first(row, ["type", "Type", "kind", "Kind", "类型"], "post")).toLowerCase();
  const ownershipKnown = hasOwn(row, momentOwnershipKeys);
  return {
    id: String(first(row, ["id", "ID", "snsId", "SnsId", "momentId", "MomentId", "动态ID"], "")),
    date,
    kind: /comment|评论/.test(rawType) ? "comment" : /like|赞/.test(rawType) ? "like" : "post",
    isOwn: ownershipKnown ? toBool(first(row, momentOwnershipKeys, false)) : false,
    ownershipKnown,
    content,
  };
}

const hasColumn = (row, keys) => keys.some((key) => row.includes(key));
const isMomentHeader = (row) => hasColumn(row, momentDateKeys) && (hasColumn(row, momentOwnerFlags) || row.some((cell) => /朋友圈|moment/i.test(cell)));

function parseBillRange(preamble) {
  const relevant = preamble.map((row) => row.join(" ")).filter((line) => /起始|开始|终止|结束|时间范围|账单周期/.test(line)).join(" ");
  const matches = relevant.match(/\d{4}(?:[-/年])\d{1,2}(?:[-/月])\d{1,2}(?:日)?(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?/g) || [];
  if (matches.length < 2) return null;
  const start = toDate(matches[0]);
  const endText = matches.at(-1);
  const end = toDate(endText);
  if (end && !endText.includes(":")) end.setHours(23, 59, 59, 999);
  return start && end && start <= end ? { start, end, declared: true } : null;
}

function rangeCoversFullCalendarYear(range) {
  if (!range?.start || !range?.end) return false;
  const year = range.start.getFullYear();
  return range.declared && range.start <= new Date(year, 0, 1) && range.end >= new Date(year, 11, 31, 23, 59, 59);
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
    warnings: [...new Set([...warnings, ...warningForSkipped(kind, skipped)])],
  };
}

function parseCsvImport(text, name) {
  const rows = parseCSV(text);
  const paymentHeader = rows.findIndex((row) => row.includes("交易时间") && row.includes("交易类型") && hasColumn(row, paymentAmountKeys));
  if (paymentHeader >= 0) {
    const objects = rowsToObjects(rows, paymentHeader);
    const payments = objects.map(normalizePayment).filter(Boolean);
    const skipped = objects.length - payments.length;
    const range = parseBillRange(rows.slice(0, paymentHeader));
    if (range && skipped) range.declared = false;
    const warnings = [];
    if (!payments.length) warnings.push("账单中没有识别到有效交易记录。");
    if (payments.length && !range) warnings.push("账单未声明起止日期，不能确认是否覆盖完整年份。");
    if (range && skipped) warnings.push("账单含无效交易行，不能确认是否覆盖完整年份。");
    return buildResult({
      source: "微信支付账单 CSV", name, kind: "支付账单", payments,
      confidence: { payments: rangeCoversFullCalendarYear(range) ? "complete" : "partial", messages: "missing", moments: "missing" },
      coverageRanges: { payments: range ? [range] : [] },
      warnings,
      skipped,
    });
  }

  const headerIndex = rows.findIndex((row) => isMomentHeader(row) || (hasColumn(row, dateKeys) && hasColumn(row, messageFields)));
  if (headerIndex < 0) throw new Error("没有识别到受支持的 CSV 表头");
  const objects = rowsToObjects(rows, headerIndex);
  const looksMoments = isMomentHeader(rows[headerIndex]);
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
  const hasSelfSenderLabel = objects.some(usesSelfSenderLabel);
  const messages = objects.map((row) => normalizeMessage(row, fallbackContact, "", hasSelfSenderLabel)).filter(Boolean);
  return buildResult({
    source: "聊天记录 CSV", name, kind: "聊天记录", messages,
    confidence: { messages: "partial", payments: "missing", moments: "missing" },
    skipped: objects.length - messages.length,
  });
}

function parseJsonImport(text, name) {
  const raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  const root = Array.isArray(raw) ? { messages: raw } : raw;
  if (!root || typeof root !== "object") throw new Error("JSON 中没有识别到 messages、payments 或 moments 数据");
  const fallbackContact = contactFromFileName(name);
  const messages = [];
  let skippedMessages = 0;
  const visitMessages = (value, sessionContact = "", depth = 0, fromArray = false, hasSelfSenderLabel = false) => {
    if (depth > 16) return;
    if (Array.isArray(value)) {
      const groupUsesSelfSenderLabel = value.some(usesSelfSenderLabel);
      value.forEach((item) => visitMessages(item, sessionContact, depth + 1, true, groupUsesSelfSenderLabel));
      return;
    }
    const childKeys = value && typeof value === "object"
      ? messageChildKeys.filter((key) => value[key] && typeof value[key] === "object") : [];
    if (childKeys.length) {
      const contact = first(value, sessionLabelKeys, sessionContact);
      childKeys.forEach((key) => visitMessages(value[key], contact, depth + 1));
      return;
    }
    const hasMessageShape = hasOwn(value, messageShapeKeys);
    const message = hasMessageShape ? normalizeMessage(value, fallbackContact, sessionContact, hasSelfSenderLabel) : null;
    if (message) messages.push(message);
    else if (fromArray || hasMessageShape) skippedMessages += 1;
  };
  messageChildKeys.forEach((key) => visitMessages(root[key]));
  const rawDataRoot = root.data ?? root.Data;
  if (rawDataRoot && typeof rawDataRoot === "object") visitMessages(rawDataRoot);
  const dataRoot = rawDataRoot && !Array.isArray(rawDataRoot) ? rawDataRoot : {};
  const paymentRows = asArray(root.payments || root.Payments || root.bills || root.Bills || dataRoot.payments || dataRoot.Payments || dataRoot.bills || dataRoot.Bills);
  const momentRows = asArray(root.moments || root.Moments || root.timeline || root.Timeline || dataRoot.moments || dataRoot.Moments || dataRoot.timeline || dataRoot.Timeline);
  const payments = paymentRows.map(normalizePayment).filter(Boolean);
  const moments = momentRows.map(normalizeMoment).filter(Boolean);
  const skippedPayments = paymentRows.length - payments.length;
  const skipped = skippedMessages + skippedPayments + momentRows.length - moments.length;
  if (!messages.length && !payments.length && !moments.length && !root.schemaVersion) {
    throw new Error(skipped ? `没有有效记录，${skipped} 条已跳过` : "JSON 中没有识别到 messages、payments 或 moments 数据");
  }
  const importedConfidence = root.confidence || {};
  const coverageRanges = root.coverageRanges || {};
  const unknownOwnership = moments.filter((item) => !item.ownershipKnown).length;
  const warnings = asArray(root.warnings).filter((warning) => typeof warning === "string" && warning.trim());
  if (unknownOwnership) warnings.push(`朋友圈有 ${unknownOwnership} 条记录没有本人归属字段，未计入个人发表、评论或点赞。`);
  return buildResult({
    source: root.schemaVersion ? (root.source === "演示数据" ? root.source : "微信年轮标准 JSON") : "兼容结构化 JSON", name,
    kind: root.schemaVersion ? "标准备份" : "结构化数据", messages, payments, moments,
    confidence: {
      messages: messages.length ? importedConfidence.messages || "partial" : "missing",
      payments: payments.length ? importedConfidence.payments || "partial" : "missing",
      moments: moments.length ? importedConfidence.moments || "partial" : "missing",
    },
    coverageRanges: skippedPayments ? {
      ...coverageRanges,
      payments: asArray(coverageRanges.payments).map((range) => ({ ...range, declared: false })),
    } : coverageRanges,
    warnings,
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
  const dedupe = (left = [], right = [], stableId, fingerprint, combine) => {
    const merged = new Map();
    for (const items of [left, right]) {
      const counts = new Map();
      for (const item of items) {
        const id = stableId(item);
        if (id) {
          const key = `id:${id}`;
          const previous = merged.get(key);
          merged.set(key, previous && combine ? combine(previous, item) : item);
          continue;
        }
        const key = fingerprint(item);
        if (key === null) {
          merged.set(Symbol(), item);
          continue;
        }
        const count = (counts.get(key) || 0) + 1;
        counts.set(key, count);
        merged.set(`record:${count}:${key}`, item);
      }
    }
    return [...merged.values()];
  };
  const confidenceRank = { missing: 0, partial: 1, complete: 2 };
  const strongest = (left = "missing", right = "missing") => confidenceRank[right] > confidenceRank[left] ? right : left;
  const diagnostics = [...(current.diagnostics || []), ...(incoming.diagnostics || [])];
  const sources = [...new Set([current.source, incoming.source].filter((source) => source && source !== "演示数据" && source !== "尚未导入"))];
  return {
    source: diagnostics.length > 3 ? `已合并 ${diagnostics.length} 个文件` : sources.join(" + ") || incoming.source,
    messages: dedupe(current.messages, incoming.messages,
      (item) => item.fragmentRef ? JSON.stringify([item.contact, "fragment", item.fragmentRef]) : item.id ? JSON.stringify([item.contact, "message", item.id]) : "",
      (item) => item.sourceFormat === "wechat-transcript" ? null : JSON.stringify([item.date.getTime(), item.contact, item.isSend, item.type, item.content, item.duration]),
      (previous, item) => item.isSend == null && typeof previous.isSend === "boolean" ? { ...item, isSend: previous.isSend } : item),
    payments: dedupe(current.payments, incoming.payments, (item) => item.id,
      (item) => JSON.stringify([item.date.getTime(), item.type, item.direction, item.amount, item.counterparty, item.note])),
    moments: dedupe(current.moments, incoming.moments, (item) => item.id,
      (item) => JSON.stringify([item.date.getTime(), item.kind, item.isOwn, item.content])),
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
