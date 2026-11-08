// Format evidence: Dukou v0.1.19, Sources/DukouCore/WeChatForward.swift and
// Tests/DukouCoreTests/WeChatExportArchiveTests.swift.
const headerPattern = /^·([^\n]*)\n(\d{4}年[^\n]*)(?:\n|$)/gm;
const datePattern = /^(\d{4})年(\d{1,2})月(\d{1,2})日 (\d{2}):(\d{2})$/;
const mediaTypes = new Map([
  ["图片", "image"], ["圖片", "image"], ["image", "image"], ["photo", "image"],
  ["视频", "video"], ["小视频", "video"], ["影片", "video"], ["微影片", "video"], ["video", "video"],
  ["文件", "file"], ["檔案", "file"], ["file", "file"],
  ["语音", "voice"], ["語音", "voice"], ["录音", "voice"], ["錄音", "voice"], ["音频", "voice"], ["音訊", "voice"],
  ["voice", "voice"], ["audio", "voice"], ["recording", "voice"],
  ["表情", "sticker"], ["动画表情", "sticker"], ["動態貼圖", "sticker"], ["sticker", "sticker"],
]);

function parseDate(value) {
  const parts = datePattern.exec(value);
  if (!parts) return null;
  const [, year, month, day, hour, minute] = parts.map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day &&
    date.getHours() === hour && date.getMinutes() === minute ? date : null;
}

export function isWeChatRedPacketMarker(content) {
  return /^\[微信红包\](?:[ \t]+[^\r\n]+)?$/.test(content.trim());
}

function messageType(content) {
  const line = content.trim();
  if (/^\[聊天记录\](?:\n|$)/.test(line)) return "link";
  if (/^\[(?:链接|連結|视频号|視頻號)\][ \t]+[^\n]*https?:\/\/\S+$/i.test(line)) return "link";
  const marker = /^\[([^\]\n]+)\][ \t]*(.*)$/.exec(line);
  const markedType = mediaTypes.get(marker?.[1].toLowerCase());
  if (markedType && (!marker[2] || /\.[a-z0-9]{1,12}$/i.test(marker[2]))) return markedType;
  const attachment = /^(?:\.\/)?(?:聊天记录内的图片、视频和文件|images|videos)\/[^\n]+\.([a-z0-9]{1,12})$/i.exec(line);
  if (!attachment) return "text";
  const extension = attachment[1].toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "heic"].includes(extension)) return "image";
  if (["mp4", "m4v", "mov", "webm", "ogv"].includes(extension)) return "video";
  return "file";
}

export function parseWeChatTranscript(text) {
  const body = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/^(?:[ \t]*\n)+/, "");
  const headers = body.matchAll(headerPattern);
  let current = headers.next().value;
  if (current?.index !== 0) return null;

  const records = [];
  const counts = new Map();
  let skipped = 0;
  const addRecord = (header, end) => {
    const [, sender, timestamp] = header;
    const date = parseDate(timestamp);
    const content = body.slice(header.index + header[0].length, end).replace(/\n+$/, "");
    if (!sender.trim() || !date || !content.trim()) {
      skipped += 1;
      return;
    }
    records.push({ sender, date, type: messageType(content), content });
    counts.set(sender, (counts.get(sender) || 0) + 1);
  };

  for (const next of headers) {
    addRecord(current, next.index);
    current = next;
  }
  addRecord(current, body.length);
  if (!records.length) throw new Error("微信导出文本中没有可用消息，请重新选择原始聊天记录 TXT 或 ZIP");
  return { records, senders: [...counts].map(([name, count]) => ({ name, count })), skipped };
}

export function transcriptDataset(name, transcript, selfName, conversationName) {
  if (selfName !== null && (typeof selfName !== "string" || !selfName.trim() ||
    !transcript.senders.some(({ name: sender }) => sender === selfName))) {
    throw new Error("请选出导出记录中的本人昵称，或明确选择本批没有本人发言");
  }
  const contact = conversationName?.trim();
  if (!contact) throw new Error("请为这批聊天记录填写会话名称");
  const messages = transcript.records.map(({ sender, date, type, content }, index) => ({
    id: "",
    date,
    isSend: sender === selfName,
    type,
    content,
    contact,
    sender,
    sourceFormat: "wechat-transcript",
    ...(transcript.signature ? { fragmentRef: `${transcript.signature}:${index}` } : {}),
    duration: 0,
    isOwnRevoke: false,
    deletedMarker: false,
  }));
  const warnings = ["微信合并转发只包含选中的消息，会话和年份可能未覆盖完整。"];
  if (transcript.skipped) warnings.push(`已跳过 ${transcript.skipped} 条时间或内容无法读取的消息。`);
  return {
    source: "微信合并转发",
    messages,
    payments: [],
    moments: [],
    confidence: { messages: "partial", payments: "missing", moments: "missing" },
    coverageRanges: { messages: [], payments: [], moments: [] },
    diagnostics: [{ file: String(name), kind: "微信合并转发", parsed: messages.length, skipped: transcript.skipped }],
    warnings,
  };
}
