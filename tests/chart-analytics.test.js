import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../src/lib/analytics.js";

const message = (date, isSend, type = "text") => ({ date, isSend, type, content: "样例" });
const payment = (month, type, direction, amount, status = "") => ({ date: new Date(2025, month, 12), type, direction, amount, status });
const moment = (month, kind, isOwn, ownershipKnown) => ({ date: new Date(2025, month, 12), kind, isOwn, ownershipKnown });

test("message trends preserve local dates and known directions, including the leap day", () => {
  const stats = analyze({ messages: [
    message(new Date(2024, 1, 29, 5, 59), true),
    message(new Date(2024, 2, 1, 6), true),
    message(new Date(2024, 2, 2, 0), false),
    message(new Date(2024, 2, 2, 4), null),
    message(new Date(2024, 2, 3, 8), undefined),
    message(new Date(2024, 2, 4, 8), false, "system"),
    message(new Date(2024, 2, 5, 8), true, "revoke"),
    message(new Date(2025, 0, 1, 1), false),
  ] }, 2024);

  assert.equal(stats.dailyCounts.length, 366);
  assert.deepEqual(stats.dailyCounts[59], { date: "2024-02-29", sent: 1, received: 0, unknown: 0, observed: true });
  assert.deepEqual(stats.dailyCounts[61], { date: "2024-03-02", sent: 0, received: 1, unknown: 1, observed: true });
  assert.deepEqual(stats.dailyCounts[62], { date: "2024-03-03", sent: 0, received: 0, unknown: 1, observed: true });
  assert.equal(stats.dailyCounts[63].observed, false);
  assert.equal(stats.monthCounts[1], 1);
  assert.equal(stats.monthCounts[2], 1);
  assert.equal(stats.receivedMonthCounts[2], 1);
  assert.equal(stats.receivedHourCounts[0], 1);
  assert.equal(stats.received, 1);
  assert.equal(stats.directionUnknown, 2);
  assert.equal(stats.totalMessages, 7);
  assert.equal(stats.streak, 2);
  assert.equal(stats.activeDays, 2);
  assert.deepEqual(stats.peakDay, { date: "2024-02-29", count: 1 });
  assert.deepEqual(stats.activityTimeCounts, {
    weekday: { sent: 2, received: 0, unknown: 0 },
    weekend: { sent: 0, received: 1, unknown: 2 },
    lateNight: { sent: 1, received: 1, unknown: 1 },
  });
});

test("monthly payment activity counts valid transactions by category and direction", () => {
  const stats = analyze({ payments: [
    payment(0, "red_packet", "out", 0.1),
    payment(0, "red_packet", "out", 0.2),
    payment(0, "red_packet", "in", 8.88),
    payment(1, "transfer", "out", 20),
    payment(1, "transfer", "in", 50),
    payment(2, "transfer", "out", 45),
    payment(2, "transfer", "out", 90, "已退款"),
    payment(2, "other", "out", 33),
  ] }, 2025);

  assert.equal(stats.paymentMonths.length, 12);
  assert.deepEqual(stats.paymentMonths[0].redSent, { count: 2, amount: "0.30" });
  assert.deepEqual(stats.paymentMonths[0].redReceived, { count: 1, amount: "8.88" });
  assert.deepEqual(stats.paymentMonths[1].transferSent, { count: 1, amount: "20.00" });
  assert.deepEqual(stats.paymentMonths[1].transferReceived, { count: 1, amount: "50.00" });
  assert.deepEqual(stats.paymentMonths[2].transferSent, { count: 1, amount: "45.00" });
  assert.deepEqual(stats.paymentMonths[11].transferSent, { count: 0, amount: "0.00" });
  assert.equal(stats.transferSentCount, 2);
  assert.equal(stats.transferSentAmount, "65.00");
  assert.equal(stats.excludedPayments, 1);
  assert.equal(stats.maxTransfer.amount, 45);
});

test("monthly moments only count verified self activity and identify unknown ownership", () => {
  const stats = analyze({ moments: [
    moment(0, "post", true, true),
    moment(1, "comment", true, true),
    moment(1, "like", true, undefined),
    moment(1, "post", false, true),
    moment(1, "comment", true, false),
    moment(1, "like", undefined, undefined),
  ] }, 2025);

  assert.equal(stats.dailyCounts.length, 365);
  assert.equal(stats.peakDay, null);
  assert.deepEqual(stats.momentMonths[0], { posts: 1, comments: 0, likes: 0 });
  assert.deepEqual(stats.momentMonths[1], { posts: 0, comments: 1, likes: 1 });
  assert.deepEqual(stats.momentOwnershipCounts, { known: 4, unknown: 2 });
  assert.equal(stats.momentsPosts, 1);
  assert.equal(stats.momentsComments, 1);
  assert.equal(stats.momentsLikes, 1);
});

test("conversation activity ranks both directions and retains dates and monthly counts", () => {
  const threadMessage = (contact, month, day, isSend, type) => ({
    ...message(new Date(2025, month, day), isSend, type), contact,
  });
  const stats = analyze({ messages: [
    threadMessage("双向", 1, 20, false),
    threadMessage("只发出", 1, 2, true),
    threadMessage("双向", 0, 4, true),
    threadMessage("只发出", 0, 3, true),
    threadMessage("双向", 1, 18, null),
    threadMessage("只发出", 2, 2, true, "system"),
    ...Array.from({ length: 12 }, (_, index) => threadMessage(`补充${index}`, 0, 5, false)),
  ] }, 2025);

  assert.equal(stats.conversations.length, 12);
  assert.equal(stats.conversations[0].name, "双向");
  assert.equal(stats.conversations[0].sent, 1);
  assert.equal(stats.conversations[0].received, 1);
  assert.equal(stats.conversations[0].unknown, 1);
  assert.deepEqual(stats.conversations[0].lastDate, new Date(2025, 1, 20));
  assert.deepEqual(stats.conversations[0].months[0], { sent: 1, received: 0, unknown: 0 });
  assert.deepEqual(stats.conversations[0].months[1], { sent: 0, received: 1, unknown: 1 });
  assert.deepEqual(stats.conversations[1].lastDate, new Date(2025, 1, 2));
  assert.deepEqual(stats.topContacts.map(({ name }) => name), ["只发出", "双向"]);
  assert.deepEqual(stats.observedRanges.messages, { first: new Date(2025, 0, 3), last: new Date(2025, 2, 2), count: 18 });
  assert.deepEqual(stats.observedRanges.moments, { first: null, last: null, count: 0 });
});

test("month coverage requires continuous declared bounds even with observed transactions", () => {
  const range = (start, end, declared = true) => ({ start, end, declared });
  const refundDate = new Date(2024, 2, 5, 12);
  const transactionDate = new Date(2024, 0, 12, 12);
  const stats = analyze({
    payments: [
      { date: refundDate, status: "已退款" },
      { date: transactionDate, type: "transfer", direction: "in", amount: 1 },
      { date: new Date(2023, 11, 31), type: "transfer", direction: "in", amount: 2 },
    ],
    moments: [{ date: refundDate, ownershipKnown: false, kind: "post" }],
    coverageRanges: { payments: [
      range(new Date(2024, 1, 13, 12), new Date(2024, 1, 29, 23, 59, 59)),
      range(new Date(2024, 0, 1), new Date(2024, 0, 31, 23, 59, 59), false),
      range(new Date(2024, 1, 1), new Date(2024, 1, 13, 11, 59, 59)),
      range(new Date(2024, 2, 1), new Date(2024, 2, 31, 23, 59, 58)),
      range(new Date(2024, 6, 1), new Date(2024, 6, 31, 23, 59, 59)),
    ] },
  }, 2024);

  assert.deepEqual(stats.paymentMonthCoverage, [false, true, false, false, false, false, true, false, false, false, false, false]);
  assert.deepEqual(stats.observedRanges.payments, { first: transactionDate, last: refundDate, count: 2 });
  assert.deepEqual(stats.observedRanges.moments, { first: refundDate, last: refundDate, count: 1 });
  assert.deepEqual(stats.paymentMonths[6].redSent, { count: 0, amount: "0.00" });
});
