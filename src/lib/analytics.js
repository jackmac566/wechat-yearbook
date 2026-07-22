const withinYear = (date, year) => date?.getFullYear() === Number(year);
const money = (value) => Number(value || 0).toFixed(2);
const localDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function longestStreak(messages) {
  const days = [...new Set(messages.map((message) => localDay(message.date)))].sort();
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

const dayStamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
};

function rangesCoverYear(ranges, year) {
  const yearStart = Date.UTC(Number(year), 0, 1);
  const yearEnd = Date.UTC(Number(year), 11, 31);
  const intervals = (ranges || []).map((range) => ({ start: dayStamp(range.start), end: dayStamp(range.end) }))
    .filter((range) => range.start !== null && range.end !== null && range.end >= yearStart && range.start <= yearEnd)
    .map((range) => ({ start: Math.max(range.start, yearStart), end: Math.min(range.end, yearEnd) }))
    .sort((left, right) => left.start - right.start);
  if (!intervals.length || intervals[0].start > yearStart) return false;
  let coveredUntil = intervals[0].end;
  for (const interval of intervals.slice(1)) {
    if (interval.start > coveredUntil + 86400000) break;
    coveredUntil = Math.max(coveredUntil, interval.end);
  }
  return coveredUntil >= yearEnd;
}

export function availableYears(dataset) {
  const records = [...(dataset.messages || []), ...(dataset.payments || []), ...(dataset.moments || [])];
  const years = records.map((record) => record.date?.getFullYear()).filter(Boolean);
  for (const ranges of Object.values(dataset.coverageRanges || {})) {
    for (const range of ranges || []) {
      const start = range.start instanceof Date ? range.start : new Date(range.start);
      const end = range.end instanceof Date ? range.end : new Date(range.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      for (let rangeYear = start.getFullYear(); rangeYear <= end.getFullYear() && rangeYear < start.getFullYear() + 50; rangeYear += 1) years.push(rangeYear);
    }
  }
  return [...new Set(years)].sort((left, right) => right - left);
}

export function analyze(dataset, year) {
  const monthCounts = Array(12).fill(0);
  const hourCounts = Array(24).fill(0);
  const contactCounts = new Map();
  const typeCountMap = new Map();
  const sentMessages = [];
  let totalMessages = 0;
  let sentCount = 0;
  let received = 0;
  let ownRevokes = 0;
  let knownDeleted = 0;
  let wordCount = 0;
  let voiceSeconds = 0;
  let firstMessage = null;
  let lastMessage = null;

  for (const message of dataset.messages || []) {
    if (!withinYear(message.date, year)) continue;
    totalMessages += 1;
    if (message.deletedMarker) knownDeleted += 1;
    if (message.type === "revoke") {
      if (message.isOwnRevoke) ownRevokes += 1;
      continue;
    }
    if (message.type === "system") continue;
    if (!message.isSend) {
      received += 1;
      continue;
    }

    sentCount += 1;
    sentMessages.push(message);
    const month = message.date.getMonth();
    const hour = message.date.getHours();
    monthCounts[month] += 1;
    hourCounts[hour] += 1;
    const contact = message.contact || "未知会话";
    contactCounts.set(contact, (contactCounts.get(contact) || 0) + 1);
    typeCountMap.set(message.type, (typeCountMap.get(message.type) || 0) + 1);
    if (message.type === "text") wordCount += [...message.content.replace(/\s/g, "")].length;
    if (message.type === "voice") voiceSeconds += Number(message.duration || 0);
    if (!firstMessage || message.date < firstMessage.date) firstMessage = message;
    if (!lastMessage || message.date > lastMessage.date) lastMessage = message;
  }

  const validPayments = [];
  let allPaymentCount = 0;
  for (const payment of dataset.payments || []) {
    if (!withinYear(payment.date, year)) continue;
    allPaymentCount += 1;
    if (!/失败|退款|退还|撤销|关闭|取消/.test(payment.status || "")) validPayments.push(payment);
  }

  const paymentGroups = { outRed: [], inRed: [], outTransfer: [], inTransfer: [] };
  for (const payment of validPayments) {
    if (payment.type === "red_packet" && payment.direction === "out") paymentGroups.outRed.push(payment);
    if (payment.type === "red_packet" && payment.direction === "in") paymentGroups.inRed.push(payment);
    if (payment.type === "transfer" && payment.direction === "out") paymentGroups.outTransfer.push(payment);
    if (payment.type === "transfer" && payment.direction === "in") paymentGroups.inTransfer.push(payment);
  }

  let momentsPosts = 0;
  let momentsComments = 0;
  let momentsLikes = 0;
  for (const moment of dataset.moments || []) {
    if (!withinYear(moment.date, year) || !moment.isOwn) continue;
    if (moment.kind === "post") momentsPosts += 1;
    if (moment.kind === "comment") momentsComments += 1;
    if (moment.kind === "like") momentsLikes += 1;
  }

  const amount = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);
  const topContacts = [...contactCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6)
    .map(([name, count]) => ({ name, count, share: sentCount ? Math.round((count / sentCount) * 100) : 0 }));
  const typeCounts = Object.fromEntries(typeCountMap);
  const peakHour = sentCount ? hourCounts.indexOf(Math.max(...hourCounts)) : null;
  const maxTransfer = paymentGroups.outTransfer.reduce((largest, payment) => !largest || payment.amount > largest.amount ? payment : largest, null);

  return {
    year: Number(year), totalMessages, sent: sentCount, received, ownRevokes, knownDeleted,
    activeDays: new Set(sentMessages.map((message) => localDay(message.date))).size,
    streak: longestStreak(sentMessages), wordCount, voiceMinutes: Math.round(voiceSeconds / 60),
    momentsPosts, momentsComments, momentsLikes,
    redSentCount: paymentGroups.outRed.length, redSentAmount: money(amount(paymentGroups.outRed)),
    redReceivedCount: paymentGroups.inRed.length, redReceivedAmount: money(amount(paymentGroups.inRed)),
    transferSentCount: paymentGroups.outTransfer.length, transferSentAmount: money(amount(paymentGroups.outTransfer)),
    transferReceivedCount: paymentGroups.inTransfer.length, transferReceivedAmount: money(amount(paymentGroups.inTransfer)),
    maxTransfer, excludedPayments: allPaymentCount - validPayments.length,
    monthCounts, hourCounts, topContacts, typeCounts, peakHour, firstMessage, lastMessage,
  };
}

export function coverage(dataset, year) {
  const inYear = (items) => (items || []).some((item) => withinYear(item.date, year));
  const segment = (name, items) => {
    const importedLevel = dataset.confidence?.[name] || "missing";
    const ranges = dataset.coverageRanges?.[name] || [];
    const hasDeclaredRange = ranges.some((range) => {
      const start = range.start instanceof Date ? range.start : new Date(range.start);
      const end = range.end instanceof Date ? range.end : new Date(range.end);
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start.getFullYear() <= Number(year) && end.getFullYear() >= Number(year);
    });
    const hasYear = inYear(items) || hasDeclaredRange;
    if (importedLevel !== "missing" && !hasYear) return { level: "out_of_year", hasYear: false };
    if (name === "payments" && hasYear && ranges.length) {
      return { level: rangesCoverYear(ranges, year) ? "complete" : "partial", hasYear: true };
    }
    return { level: importedLevel, hasYear };
  };
  const messages = segment("messages", dataset.messages);
  const payments = segment("payments", dataset.payments);
  const moments = segment("moments", dataset.moments);
  const scoreMap = { complete: 100, partial: 62, missing: 0, out_of_year: 0 };
  return {
    score: Math.round([messages.level, payments.level, moments.level].reduce((score, level) => score + scoreMap[level], 0) / 3),
    messages,
    payments,
    moments,
  };
}
