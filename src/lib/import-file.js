import { parseImport } from "./parser.js";
import { readWeChatArchive } from "./wechat-archive.js";
import { parseWeChatTranscript } from "./wechat-transcript.js";

export const isChatArchive = (name) => /\.zip$/i.test(name);

async function readTranscript(text) {
  if (/^\uFEFF?聊天：[^\r\n]+\r?\n说明：按导出批次/.test(text)) {
    throw new Error("这是渡口的多批合并归档。请解压后选择 batches 中各批原始的聊天记录.txt");
  }
  const transcript = parseWeChatTranscript(text);
  if (!transcript) return null;
  const bytes = new TextEncoder().encode(JSON.stringify(transcript.records));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const signature = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { ...transcript, signature };
}

export async function parseImportText(name, text) {
  if (/\.txt$/i.test(name)) {
    const transcript = await readTranscript(text);
    if (transcript) return { transcript };
  }
  return { dataset: parseImport(name, text) };
}

export async function parseImportArchive(file, onParsing) {
  const { text } = await readWeChatArchive(file);
  onParsing();
  const transcript = await readTranscript(text);
  if (!transcript) throw new Error("聊天记录.txt 的内容与当前支持的微信转发格式不符");
  return { transcript };
}
