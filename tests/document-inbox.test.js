import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import inboxModule from "../electron/document-inbox.cjs";

const { createDocumentInbox, readDocument } = inboxModule;

function renderer() {
  const deliveries = [];
  const events = new EventEmitter();
  return {
    deliveries,
    async nextDelivery() {
      const [delivery] = await once(events, "delivery");
      return delivery;
    },
    send(channel, id, files) {
      assert.equal(channel, "yearbook-inbox-files");
      const delivery = { id, files };
      deliveries.push(delivery);
      events.emit("delivery", delivery);
    },
  };
}

const readName = async (filePath) => Buffer.from(path.basename(filePath));

test("documents received before startup wait for the renderer and settle in order", async () => {
  const cleaned = [];
  const inbox = createDocumentInbox({ read: readName, cleanup: async (filePath) => cleaned.push(filePath) });
  const sender = renderer();
  assert.equal(inbox.enqueue("unsupported.png"), false);
  assert.equal(inbox.enqueue("first.ZIP"), true);
  inbox.enqueue(path.resolve("first.ZIP"));
  inbox.enqueue("second.txt");
  await setImmediate();
  assert.equal(sender.deliveries.length, 0);

  inbox.connect(sender);
  await setImmediate();
  assert.deepEqual(sender.deliveries[0].files, [{ name: "first.ZIP", data: Buffer.from("first.ZIP") }]);
  const firstId = sender.deliveries[0].id;
  inbox.acknowledge(renderer(), firstId);
  inbox.acknowledge(sender, firstId + 1);
  await setImmediate();
  assert.equal(sender.deliveries.length, 1);
  assert.deepEqual(cleaned, []);

  inbox.acknowledge(sender, firstId);
  await setImmediate();
  assert.equal(sender.deliveries[1].files[0].name, "second.txt");
  assert.deepEqual(cleaned, [path.resolve("first.ZIP")]);
  inbox.acknowledge(sender, sender.deliveries[1].id);
  inbox.enqueue("first.ZIP");
  await setImmediate();
  assert.equal(sender.deliveries[2].files[0].name, "first.ZIP");
});

test("renderer reload resends the unacknowledged item and ignores the previous attempt", async () => {
  const inbox = createDocumentInbox({ read: readName });
  const sender = renderer();
  inbox.connect(sender);
  inbox.enqueue("retry.zip");
  inbox.enqueue("queued.txt");
  await setImmediate();
  const first = sender.deliveries[0];
  inbox.disconnect(sender);
  inbox.connect(sender);
  await setImmediate();
  const retry = sender.deliveries[1];
  assert.deepEqual(retry.files, first.files);
  assert.notEqual(retry.id, first.id);
  inbox.acknowledge(sender, first.id);
  await setImmediate();
  assert.equal(sender.deliveries.length, 2);
  inbox.acknowledge(sender, retry.id);
  await setImmediate();
  assert.equal(sender.deliveries[2].files[0].name, "queued.txt");
});

test("documents stay queued when a renderer disconnects during reading", async () => {
  const reads = [];
  const inbox = createDocumentInbox({ read: (filePath) => new Promise((resolve) => reads.push(() => resolve(readName(filePath)))) });
  const beforeReload = renderer();
  inbox.connect(beforeReload);
  inbox.enqueue("retry.zip");
  inbox.disconnect(beforeReload);
  const afterReload = renderer();
  inbox.connect(afterReload);
  reads.shift()();
  await setImmediate();
  assert.deepEqual(beforeReload.deliveries, []);
  reads.shift()();
  await setImmediate();
  assert.equal(afterReload.deliveries[0].files[0].name, "retry.zip");
});

test("missing file errors expose no local path and keep the next document queued", async (t) => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "yearbook-inbox-test-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const existing = path.join(folder, "example.txt");
  await writeFile(existing, "synthetic");
  const directory = path.join(folder, "folder.zip");
  await mkdir(directory);
  await assert.rejects(readDocument(directory), /普通文件/);
  await assert.rejects(readDocument(existing, 4), /文件超过/);
  assert.equal((await readDocument(existing)).toString(), "synthetic");

  const inbox = createDocumentInbox();
  const sender = renderer();
  const firstDelivery = sender.nextDelivery();
  inbox.connect(sender);
  inbox.enqueue(path.join(folder, "missing.zip"));
  inbox.enqueue(existing);
  const failed = await firstDelivery;
  assert.deepEqual(failed.files, [{ name: "missing.zip", error: "无法读取文件，请检查权限后重新打开" }]);
  assert.equal(sender.deliveries.length, 1);
  const secondDelivery = sender.nextDelivery();
  inbox.acknowledge(sender, failed.id);
  const successful = await secondDelivery;
  assert.deepEqual(successful.files, [{ name: "example.txt", data: Buffer.from("synthetic") }]);
});
