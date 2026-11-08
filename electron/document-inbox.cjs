const { constants } = require("fs");
const fs = require("fs/promises");
const path = require("path");

const maxFileBytes = 128 * 1024 * 1024;
const supportsDocument = (filePath) => typeof filePath === "string" && /\.(zip|txt|json|csv)$/i.test(filePath);

async function readDocument(filePath, maxBytes = maxFileBytes) {
  const file = await fs.open(filePath, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const before = await file.stat();
    if (!before.isFile()) throw new Error("请选择普通文件");
    if (before.size > maxBytes) throw new Error("文件超过 128 MB，请分批导入");

    const data = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < data.length) {
      const { bytesRead } = await file.read(data, offset, data.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await file.stat();
    if (offset !== data.length || after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
      throw new Error("文件正在更改，请保存后重新打开");
    }
    return data;
  } finally {
    await file.close();
  }
}

function createDocumentInbox({ read = readDocument, cleanup = async () => {} } = {}) {
  const queue = [];
  let sequence = 0;
  let receiver = null;
  let inFlight = null;
  let reading = false;

  async function drain() {
    if (reading || inFlight || !receiver || !queue.length) return;
    reading = true;
    const target = receiver;
    const filePath = queue[0];
    const name = path.basename(filePath);
    let file;
    try {
      file = { name, data: await read(filePath) };
    } catch (error) {
      file = { name, error: error instanceof Error && !error.code ? error.message : "无法读取文件，请检查权限后重新打开" };
    } finally {
      reading = false;
    }
    if (receiver !== target) {
      void drain();
      return;
    }
    const id = ++sequence;
    inFlight = { id, target };
    try {
      target.sender.send("yearbook-inbox-files", id, [file]);
    } catch {
      receiver = null;
      inFlight = null;
    }
  }

  return {
    enqueue(filePath) {
      if (!supportsDocument(filePath)) return false;
      const resolved = path.resolve(filePath);
      if (!queue.includes(resolved)) {
        queue.push(resolved);
        void drain();
      }
      return true;
    },
    connect(sender) {
      if (receiver?.sender === sender) return;
      inFlight = null;
      receiver = { sender };
      void drain();
    },
    disconnect(sender) {
      if (receiver?.sender !== sender) return;
      receiver = null;
      inFlight = null;
    },
    acknowledge(sender, id) {
      if (inFlight?.target.sender !== sender || inFlight.id !== id) return;
      const filePath = queue.shift();
      inFlight = null;
      void cleanup(filePath).catch(() => {});
      void drain();
    },
  };
}

module.exports = { createDocumentInbox, readDocument, supportsDocument };
