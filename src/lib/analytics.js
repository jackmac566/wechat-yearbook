const withinYear = (date, year) => date?.getFullYear() === Number(year);
const sum = (items, getter = (x) => x) => items.reduce((total, item) => total + Number(getter(item) || 0), 0);
const countBy = (items, getter) => items.reduce((acc, item) => {
  const key = getter(item);
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
const money = (value) => Number(value || 0).toFixed(2);
const localDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function longestStreak(messages) {
  const days = [...new Set(messages.map((m) => localDay(m.date)))].sort();
  let best = 0;
  let current = 0;
  let previous = null;
  for (const day of days) {
    const [year, month, date] = day.split("-").map(Number);
    const stamp = Date.UTC(year, month - 1, date);
    current = previous !== null && stamp - previous === 86400000 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = stamp;
  }
  return best;
}

export function availableYears(dataset) {
  const years = [...dataset.messages, ...dataset.payments, ...dataset.moments].map((x) => x.date?.getFullYear()).filter(Boolean);
  return [...new Set(years)].sort((a, b) => b - a);
}

export function analyze(dataset, year) {
  const messages = dataset.messages.filter((x) => withinYear(x.date, year));
  const sent = messages.filter((x) => x.isSend && x.type !== "revoke");
  const allPayments = dataset.payments.filter((x) => withinYear(x.date, year));
  const payments = allPayments.filter((x) => !/失败|退款|退还|撤销|关闭|取消/.test(x.status || ""));
  const moments = dataset.moments.filter((x) => withinYear(x.date, year) && x.isOwn);
  const outRed = payments.filter((x) => x.type === "red_packet" && x.direction === "out");
  const inRed = payments.filter((x) => x.type === "red_packet" && x.direction === "in");
  const outTransfer = payments.filter((x) => x.type === "transfer" && x.direction === "out");
  const inTransfer = payments.filter((x) => x.type === "transfer" && x.direction === "in");
  const monthCounts = Array.from({ length: 12 }, (_, month) => sent.filter((x) => x.date.getMonth() === month).length);
  const hourCounts = Array.from({ length: 24 }, (_, hour) => sent.filter((x) => x.date.getHours() === hour).length);
  const contactCounts = countBy(sent, (x) => x.contact || "未知会话");
  const topContacts = Object.entries(contactCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count, share: sent.length ? Math.round((count / sent.length) * 100) : 0 }));
  const typeCounts = countBy(sent, (x) => x.type);
  const activeDays = new Set(sent.map((x) => localDay(x.date))).size;
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const firstMessage = [...sent].sort((a, b) => a.date - b.date)[0];
  const lastMessage = [...sent].sort((a, b) => b.date - a.date)[0];
  const wordCount = sum(sent.filter((x) => x.type === "text"), (x) => x.content.replace(/\s/g, "").length);
  const ownRevokes = messages.filter((x) => x.type === "revoke" && x.isOwnRevoke).length;
  const knownDeleted = messages.filter((x) => x.deletedMarker).length;
  const voiceSeconds = sum(sent.filter((x) => x.type === "voice"), (x) => x.duration);
  const maxTransfer = [...outTransfer].sort((a, b) => b.amount - a.amount)[0];

  return {
    year: Number(year), totalMessages: messages.length, sent: sent.length, received: messages.filter((x) => !x.isSend && x.type !== "revoke").length,
    ownRevokes, knownDeleted, activeDays, streak: longestStreak(sent), wordCount, voiceMinutes: Math.round(voiceSeconds / 60),
    momentsPosts: moments.filter((x) => x.kind === "post").length,
    momentsComments: moments.filter((x) => x.kind === "comment").length,
    momentsLikes: moments.filter((x) => x.kind === "like").length,
    redSentCount: outRed.length, redSentAmount: money(sum(outRed, (x) => x.amount)),
    redReceivedCount: inRed.length, redReceivedAmount: money(sum(inRed, (x) => x.amount)),
    transferSentCount: outTransfer.length, transferSentAmount: money(sum(outTransfer, (x) => x.amount)),
    transferReceivedCount: inTransfer.length, transferReceivedAmount: money(sum(inTransfer, (x) => x.amount)),
    maxTransfer, excludedPayments: allPayments.length - payments.length, monthCounts, hourCounts, topContacts, typeCounts, peakHour, firstMessage, lastMessage,
  };
}

export function coverage(dataset, year) {
  const inYear = (items) => items.some((x) => withinYear(x.date, year));
  const segment = (name, items) => {
    const importedLevel = dataset.confidence?.[name] || "missing";
    const hasYear = inYear(items);
    return { level: importedLevel !== "missing" && !hasYear ? "out_of_year" : importedLevel, hasYear };
  };
  const messages = segment("messages", dataset.messages);
  const payments = segment("payments", dataset.payments);
  const moments = segment("moments", dataset.moments);
  const levels = [messages.level, payments.level, moments.level];
  const scoreMap = { complete: 100, partial: 62, missing: 0 };
  return {
    score: Math.round(levels.reduce((s, x) => s + (scoreMap[x] || 0), 0) / 3),
    messages,
    payments,
    moments,
  };
}
