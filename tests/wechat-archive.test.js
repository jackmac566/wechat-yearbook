import assert from "node:assert/strict";
import test from "node:test";
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js/index-native.js";
import { readWeChatArchive } from "../src/lib/wechat-archive.js";

const transcriptName = "聊天记录.txt";
const transcript = "·示例甲\n2025年1月1日 09:00\n第一行\n第二行\n";
const zipFile = (bytes) => new File([bytes], "示例.zip");

async function archive(entries, options = {}) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const [name, contents, entryOptions] of entries) {
    const reader = typeof contents === "string" ? new TextReader(contents) : new Uint8ArrayReader(contents);
    await writer.add(name, reader, { dataDescriptor: false, ...options, ...entryOptions });
  }
  return Buffer.from(await (await writer.close()).arrayBuffer());
}

function localAndCentralOffsets(bytes) {
  return [bytes.indexOf("PK\x03\x04"), bytes.indexOf("PK\x01\x02")];
}

test("reads the native UTF-8 transcript even without the ZIP filename flag", async () => {
  const bytes = await archive([[transcriptName, transcript]]);
  const [local, central] = localAndCentralOffsets(bytes);
  bytes.writeUInt16LE(bytes.readUInt16LE(local + 6) & ~0x800, local + 6);
  bytes.writeUInt16LE(bytes.readUInt16LE(central + 8) & ~0x800, central + 8);
  assert.deepEqual(await readWeChatArchive(zipFile(bytes)), { name: transcriptName, text: transcript });
});

test("reads a merged transcript without opening original batches, previews, or media", async () => {
  const corruptible = "synthetic media bytes";
  const bytes = await archive([
    [transcriptName, transcript],
    [`batches/0001/${transcriptName}`, "original"],
    [`batches/${transcriptName}`, "original"],
    [`__MACOSX/${transcriptName}`, "metadata"],
    [`media/${transcriptName}`, "attachment"],
    ["聊天记录内的图片、视频和文件/sample.png", corruptible, { level: 0 }],
    ["index.html", "<script>document.body.textContent='ignore'</script>"],
  ]);
  bytes[bytes.indexOf(corruptible)] ^= 0x01;
  assert.deepEqual(await readWeChatArchive(zipFile(bytes)), { name: transcriptName, text: transcript });
});

test("reads a unique wrapper-level transcript and rejects ambiguous or unrelated archives", async () => {
  const nested = `包装目录/${transcriptName}`;
  assert.deepEqual(await readWeChatArchive(zipFile(await archive([[nested, transcript]]))), { name: nested, text: transcript });
  await assert.rejects(readWeChatArchive(zipFile(await archive([[nested, transcript], [`另一目录/${transcriptName}`, transcript]]))), /多份/);
  await assert.rejects(readWeChatArchive(zipFile(await archive([["README.txt", transcript]]))), /找不到聊天记录/);
  await assert.rejects(readWeChatArchive(zipFile(await archive([[`聊天记录内的图片、视频和文件/${transcriptName}`, transcript]]))), /找不到聊天记录/);
});

test("rejects traversal, encryption, and symbolic links", async () => {
  const bytes = await archive([[transcriptName, transcript], ["ok/escape.txt", "file"]]);
  const unsafeName = Buffer.from("../escape.txt");
  const first = bytes.indexOf("ok/escape.txt");
  const second = bytes.indexOf("ok/escape.txt", first + 1);
  unsafeName.copy(bytes, first);
  unsafeName.copy(bytes, second);
  await assert.rejects(readWeChatArchive(zipFile(bytes)), /不安全的文件路径/);
  const encrypted = await archive([[transcriptName, transcript]], { password: "synthetic", zipCrypto: true });
  await assert.rejects(readWeChatArchive(zipFile(encrypted)), /加密 ZIP/);
  const symlink = await archive([[transcriptName, "ignored.txt", { unixMode: 0o120777 }]]);
  await assert.rejects(readWeChatArchive(zipFile(symlink)), /符号链接/);
});

test("rejects checksum mismatches, damaged ZIP data, and malformed UTF-8", async () => {
  const bytes = await archive([[transcriptName, transcript, { level: 0 }]]);
  bytes[bytes.indexOf(transcript)] ^= 0x01;
  await assert.rejects(readWeChatArchive(zipFile(bytes)), /ZIP 已损坏/);
  await assert.rejects(readWeChatArchive(zipFile(bytes.subarray(0, -6))), /ZIP 已损坏/);
  const invalidUtf8 = await archive([[transcriptName, Uint8Array.of(0xff, 0xff)]]);
  await assert.rejects(readWeChatArchive(zipFile(invalidUtf8)), /UTF-8/);
});

test("bounds archive size and inflated text, even when both headers underreport the text size", async () => {
  const megabyte = new Blob([new Uint8Array(1024 * 1024)]);
  await assert.rejects(readWeChatArchive(new File(Array(129).fill(megabyte), "oversize.zip")), /超过 128 MB/);

  const bytes = await archive([[transcriptName, "a".repeat(8 * 1024 * 1024 + 1)]]);
  await assert.rejects(readWeChatArchive(zipFile(bytes)), /超过 8 MB/);
  const [local, central] = localAndCentralOffsets(bytes);
  bytes.writeUInt32LE(1, local + 22);
  bytes.writeUInt32LE(1, central + 24);
  await assert.rejects(readWeChatArchive(zipFile(bytes)), /ZIP 已损坏/);
});
