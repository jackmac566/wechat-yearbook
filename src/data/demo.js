const rng = (() => {
  let seed = 20250721;
  return () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
})();

const contacts = ["老王不加班", "大学舍友群", "妈妈", "强鹰业务群", "阿航", "游戏搭子", "文件传输助手"];
const types = ["text", "text", "text", "image", "voice", "sticker", "video", "link", "file", "poke"];
const messages = [];
for (let month = 0; month < 12; month += 1) {
  const total = 700 + Math.floor(rng() * 700);
  for (let i = 0; i < total; i += 1) {
    const day = 1 + Math.floor(rng() * 27);
    const hour = rng() > 0.75 ? 22 + Math.floor(rng() * 2) : 8 + Math.floor(rng() * 14);
    const type = types[Math.floor(rng() * types.length)];
    messages.push({
      date: new Date(2025, month, day, hour, Math.floor(rng() * 60)),
      isSend: rng() > 0.42,
      type,
      content: type === "text" ? ["收到", "哈哈哈哈", "晚点回你", "这个想法可以", "明天见", "在吗"][Math.floor(rng() * 6)] : "",
      contact: contacts[Math.floor(rng() * contacts.length)],
      duration: type === "voice" ? 2 + Math.floor(rng() * 45) : 0,
      isOwnRevoke: false,
      deletedMarker: false,
    });
  }
}
for (let i = 0; i < 43; i += 1) messages.push({ date: new Date(2025, Math.floor(rng() * 12), 1 + Math.floor(rng() * 27), 12), isSend: true, type: "revoke", content: "你撤回了一条消息", contact: contacts[Math.floor(rng() * contacts.length)], isOwnRevoke: true, deletedMarker: false, duration: 0 });

const payments = [];
for (let i = 0; i < 74; i += 1) payments.push({ date: new Date(2025, Math.floor(rng() * 12), 1 + Math.floor(rng() * 27)), type: "red_packet", direction: rng() > 0.36 ? "out" : "in", amount: Number((1 + rng() * 188).toFixed(2)), counterparty: contacts[Math.floor(rng() * contacts.length)] });
for (let i = 0; i < 39; i += 1) payments.push({ date: new Date(2025, Math.floor(rng() * 12), 1 + Math.floor(rng() * 27)), type: "transfer", direction: rng() > 0.44 ? "out" : "in", amount: Number((30 + rng() * 1800).toFixed(2)), counterparty: contacts[Math.floor(rng() * contacts.length)] });

const moments = [
  ...Array.from({ length: 28 }, (_, i) => ({ date: new Date(2025, i % 12, 2 + (i % 25)), kind: "post", isOwn: true, content: "生活记录" })),
  ...Array.from({ length: 96 }, (_, i) => ({ date: new Date(2025, i % 12, 1 + (i % 27)), kind: "comment", isOwn: true, content: "评论" })),
  ...Array.from({ length: 183 }, (_, i) => ({ date: new Date(2025, i % 12, 1 + (i % 27)), kind: "like", isOwn: true, content: "点赞" })),
];

export const demoDataset = {
  source: "演示数据",
  messages,
  payments,
  moments,
  confidence: { messages: "partial", payments: "complete", moments: "partial" },
  warnings: ["当前展示的是演示数据，导入自己的文件后会自动替换。"],
};
