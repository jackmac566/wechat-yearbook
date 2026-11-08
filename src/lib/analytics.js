import { isWeChatRedPacketMarker } from "./wechat-transcript.js";

const withinYear = (date, year) => date?.getFullYear() === Number(year);
const money = (value) => Number(value || 0).toFixed(2);
const directionCounts = () => ({ sent: 0, received: 0, unknown: 0 });
const paymentTotals = () => ({ redSent: { count: 0, amount: 0 }, redReceived: { count: 0, amount: 0 }, transferSent: { count: 0, amount: 0 }, transferReceived: { count: 0, amount: 0 } });
const monthSeries = (makeMonth) => Array.from({ length: 12 }, makeMonth);
const observedRange = () => ({ first: null, last: null, count: 0 });
const totalDirections = ({ sent, received, unknown }) => sent + received + unknown;
const momentFields = new Map([["post", "posts"], ["comment", "comments"], ["like", "likes"]]);
const paymentFields = new Map([["red_packet:out", "redSent"], ["red_packet:in", "redReceived"], ["transfer:out", "transferSent"], ["transfer:in", "transferReceived"]]);

function observe(range, date) {
  range.count += 1;
  if (!range.first || date < range.first) range.first = date;
  if (!range.last || date > range.last) range.last = date;
}

function calendarDays(year) {
  const months = monthSeries(() => []);
  // Use UTC only to step through date labels. Messages are bucketed by local date.
  const day = new Date(0);
  day.setUTCFullYear(year, 0, 1);
  while (day.getUTCFullYear() === year) {
    const month = day.getUTCMonth();
    const monthText = String(month + 1).padStart(2, "0");
    const dayText = String(day.getUTCDate()).padStart(2, "0");
    months[month].push({ date: `${String(year).padStart(4, "0")}-${monthText}-${dayText}`, ...directionCounts(), observed: false });
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return months;
}

function activitySummary(days) {
  let activeDays = 0;
  let streak = 0;
  let current = 0;
  let peakDay = null;
  for (const { date, sent } of days) {
    if (!sent) {
      current = 0;
      continue;
    }
    activeDays += 1;
    current += 1;
    streak = Math.max(streak, current);
    if (!peakDay || sent > peakDay.count) peakDay = { date, count: sent };
  }
  return { activeDays, streak, peakDay };
}

function localMonthStart(year, month) {
  const date = new Date(2000, 0, 1);
  date.setFullYear(Number(year), month, 1);
  return date;
}

export function localYearStart(year) {
  return localMonthStart(year, 0);
}

function declaredIntervals(ranges = []) {
  return ranges.filter((range) => range.declared === true && range.start != null && range.end != null)
    .map((range) => ({ start: new Date(range.start).getTime(), end: new Date(range.end).getTime() }))
    .filter((range) => range.start <= range.end);
}

function mergeIntervals(intervals) {
  intervals.sort((left, right) => left.start - right.start);
  const merged = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    // WeChat bill exports use inclusive bounds with one-second precision.
    if (previous && interval.start <= previous.end + 1000) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

function coversPeriod(intervals, start, nextStart) {
  return intervals.some((interval) => interval.start <= start && interval.end + 1000 >= nextStart);
}

export function availableYears(dataset) {
  const years = new Set();
  for (const records of [dataset.messages || [], dataset.payments || [], dataset.moments || []]) {
    for (const record of records) {
      const year = record.date?.getFullYear();
      if (Number.isFinite(year)) years.add(year);
    }
  }
  for (const ranges of Object.values(dataset.coverageRanges || {})) {
    for (const range of declaredIntervals(ranges)) {
      const startYear = new Date(range.start).getFullYear();
      const endYear = new Date(range.end).getFullYear();
      for (let rangeYear = startYear; rangeYear <= endYear && rangeYear < startYear + 50; rangeYear += 1) years.add(rangeYear);
    }
  }
  return [...years].sort((left, right) => right - left);
}

export function analyze(dataset, year) {
  const monthCounts = Array(12).fill(0);
  const hourCounts = Array(24).fill(0);
  const receivedMonthCounts = Array(12).fill(0);
  const receivedHourCounts = Array(24).fill(0);
  const daysByMonth = calendarDays(Number(year));
  const dailyCounts = daysByMonth.flat();
  const activityTimeCounts = { weekday: directionCounts(), weekend: directionCounts(), lateNight: directionCounts() };
  const observedRanges = { messages: observedRange(), payments: observedRange(), moments: observedRange() };
  const conversationCounts = new Map();
  const contactCounts = new Map();
  const chatRedPackets = directionCounts();
  const typeCountMap = new Map();
  let totalMessages = 0;
  let sentCount = 0;
  let received = 0;
  let directionUnknown = 0;
  let ownRevokes = 0;
  let knownDeleted = 0;
  let wordCount = 0;
  let voiceSeconds = 0;
  let firstMessage = null;
  let lastMessage = null;

  for (const message of dataset.messages || []) {
    if (!withinYear(message.date, year)) continue;
    totalMessages += 1;
    observe(observedRanges.messages, message.date);
    if (message.deletedMarker) knownDeleted += 1;
    if (message.type === "revoke") {
      if (message.isOwnRevoke) ownRevokes += 1;
      continue;
    }
    if (message.type === "system") continue;
    const direction = message.isSend === true ? "sent" : message.isSend === false ? "received" : "unknown";
    // Classify only for reporting, keeping old transcript fingerprints and backups stable.
    const transcriptRedPacket = message.sourceFormat === "wechat-transcript" &&
      (message.type === "red_packet" || (message.type === "text" && isWeChatRedPacketMarker(message.content || "")));
    if (transcriptRedPacket) chatRedPackets[direction] += 1;
    const month = message.date.getMonth();
    const hour = message.date.getHours();
    const day = daysByMonth[month][message.date.getDate() - 1];
    day.observed = true;
    day[direction] += 1;
    const weekday = message.date.getDay();
    activityTimeCounts[weekday === 0 || weekday === 6 ? "weekend" : "weekday"][direction] += 1;
    if (hour < 6) activityTimeCounts.lateNight[direction] += 1;
    const contact = message.contact || "未知会话";
    let conversation = conversationCounts.get(contact);
    if (!conversation) {
      conversation = { name: contact, ...directionCounts(), lastDate: message.date, months: new Map() };
      conversationCounts.set(contact, conversation);
    }
    conversation[direction] += 1;
    if (message.date > conversation.lastDate) conversation.lastDate = message.date;
    if (!conversation.months.has(month)) conversation.months.set(month, directionCounts());
    conversation.months.get(month)[direction] += 1;

    if (direction !== "sent") {
      if (direction === "received") {
        received += 1;
        receivedMonthCounts[month] += 1;
        receivedHourCounts[hour] += 1;
      } else {
        directionUnknown += 1;
      }
      continue;
    }

    sentCount += 1;
    monthCounts[month] += 1;
    hourCounts[hour] += 1;
    contactCounts.set(contact, (contactCounts.get(contact) || 0) + 1);
    const reportedType = transcriptRedPacket ? "red_packet" : message.type;
    typeCountMap.set(reportedType, (typeCountMap.get(reportedType) || 0) + 1);
    if (reportedType === "text") wordCount += [...message.content.replace(/\s/g, "")].length;
    if (message.type === "voice") voiceSeconds += Number(message.duration || 0);
    if (!firstMessage || message.date < firstMessage.date) firstMessage = message;
    if (!lastMessage || message.date > lastMessage.date) lastMessage = message;
  }

  const paymentYear = paymentTotals();
  const paymentMonths = monthSeries(paymentTotals);
  const paymentIntervals = mergeIntervals(declaredIntervals(dataset.coverageRanges?.payments));
  const paymentMonthCoverage = monthSeries((_, month) => coversPeriod(paymentIntervals, localMonthStart(year, month), localMonthStart(year, month + 1)));
  let excludedPayments = 0;
  let maxTransfer = null;
  const sentRedPacketPayments = [];
  for (const payment of dataset.payments || []) {
    if (!withinYear(payment.date, year)) continue;
    observe(observedRanges.payments, payment.date);
    if (/失败|退款|退还|撤销|关闭|取消/.test(payment.status || "")) {
      excludedPayments += 1;
      continue;
    }
    const field = paymentFields.get(`${payment.type}:${payment.direction}`);
    if (!field) continue;
    const amount = Number(payment.amount || 0);
    const month = paymentMonths[payment.date.getMonth()][field];
    paymentYear[field].count += 1;
    paymentYear[field].amount += amount;
    month.count += 1;
    month.amount += amount;
    if (field === "redSent") sentRedPacketPayments.push(payment);
    if (field === "transferSent" && (!maxTransfer || payment.amount > maxTransfer.amount)) maxTransfer = payment;
  }
  for (const month of paymentMonths) {
    for (const bucket of Object.values(month)) bucket.amount = money(bucket.amount);
  }

  const momentYear = { posts: 0, comments: 0, likes: 0 };
  const momentMonths = monthSeries(() => ({ posts: 0, comments: 0, likes: 0 }));
  const momentOwnershipCounts = { known: 0, unknown: 0 };
  for (const moment of dataset.moments || []) {
    if (!withinYear(moment.date, year)) continue;
    observe(observedRanges.moments, moment.date);
    if (moment.ownershipKnown === false || typeof moment.isOwn !== "boolean") {
      momentOwnershipCounts.unknown += 1;
      continue;
    }
    momentOwnershipCounts.known += 1;
    const field = momentFields.get(moment.kind);
    if (!moment.isOwn || !field) continue;
    momentYear[field] += 1;
    momentMonths[moment.date.getMonth()][field] += 1;
  }

  const topContacts = [...contactCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6)
    .map(([name, count]) => ({ name, count, share: sentCount ? Math.round((count / sentCount) * 100) : 0 }));
  const conversations = [...conversationCounts.values()].sort((left, right) => totalDirections(right) - totalDirections(left)).slice(0, 12)
    .map((conversation) => ({ ...conversation, months: monthSeries((_, month) => conversation.months.get(month) || directionCounts()) }));
  const typeCounts = Object.fromEntries(typeCountMap);
  const peakHour = sentCount ? hourCounts.indexOf(Math.max(...hourCounts)) : null;

  return {
    year: Number(year), totalMessages, sent: sentCount, received, directionUnknown, ownRevokes, knownDeleted,
    observedRanges, conversations, chatRedPackets,
    ...activitySummary(dailyCounts), dailyCounts, activityTimeCounts, receivedMonthCounts, receivedHourCounts,
    wordCount, voiceMinutes: Math.round(voiceSeconds / 60),
    momentsPosts: momentYear.posts, momentsComments: momentYear.comments, momentsLikes: momentYear.likes,
    momentMonths, momentOwnershipCounts,
    redSentCount: paymentYear.redSent.count, redSentAmount: money(paymentYear.redSent.amount),
    redReceivedCount: paymentYear.redReceived.count, redReceivedAmount: money(paymentYear.redReceived.amount),
    transferSentCount: paymentYear.transferSent.count, transferSentAmount: money(paymentYear.transferSent.amount),
    transferReceivedCount: paymentYear.transferReceived.count, transferReceivedAmount: money(paymentYear.transferReceived.amount),
    maxTransfer, excludedPayments, paymentMonths, paymentMonthCoverage, sentRedPacketPayments,
    monthCounts, hourCounts, topContacts, typeCounts, peakHour, firstMessage, lastMessage,
  };
}

export function coverage(dataset, year) {
  const yearStart = localYearStart(year).getTime();
  const nextYearStart = localYearStart(Number(year) + 1).getTime();
  const segment = (name) => {
    const items = dataset[name] || [];
    const importedLevel = dataset.confidence?.[name];
    const declared = declaredIntervals(dataset.coverageRanges?.[name]);
    const intervals = declared.filter(({ start, end }) => start < nextYearStart && end >= yearStart);
    const hasYear = intervals.length > 0 || items.some((item) => withinYear(item.date, year));
    if (!hasYear) {
      const hasOtherYears = items.length > 0 || declared.length > 0;
      return { level: hasOtherYears ? "out_of_year" : "missing", hasYear: false };
    }
    if (name === "messages" && items.some((item) => item.sourceFormat === "wechat-transcript" && withinYear(item.date, year))) {
      return { level: "partial", hasYear: true, hasFragments: true };
    }
    const complete = name === "payments"
      ? coversPeriod(mergeIntervals(intervals), yearStart, nextYearStart)
      : importedLevel === "complete";
    return { level: complete ? "complete" : "partial", hasYear: true };
  };
  const messages = segment("messages");
  const payments = segment("payments");
  const moments = segment("moments");
  const scoreMap = { complete: 100, partial: 62, missing: 0, out_of_year: 0 };
  return {
    score: Math.round([messages.level, payments.level, moments.level].reduce((score, level) => score + scoreMap[level], 0) / 3),
    messages,
    payments,
    moments,
  };
}
