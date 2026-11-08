import { BlobReader, ERR_AMBIGUOUS_ARCHIVE, ERR_UNSAFE_FILENAME, ZipReader } from "@zip.js/zip.js/index-native.js";

const transcriptName = "聊天记录.txt";
const maxArchiveBytes = 128 * 1024 * 1024;
const maxTranscriptBytes = 8 * 1024 * 1024;
const maxEntries = 1000;
const ignoredDirectories = new Set(["__macosx", "media", "batches", "聊天记录内的图片、视频和文件"]);
const sizeError = "ZIP 内的聊天记录超过 8 MB，请分批导出。";

class WeChatArchiveError extends Error {}

function decodeFilename(bytes, _encoding, kind) {
  if (kind !== "filename") return undefined;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new WeChatArchiveError("ZIP 文件名不是有效的 UTF-8。");
  }
}

function isTranscript(entry) {
  const { filename, directory, encrypted, symlink, unixMode } = entry;
  if (filename.includes("\\")) throw new WeChatArchiveError("ZIP 包含不安全的文件路径。");
  if (encrypted) throw new WeChatArchiveError("微信年轮无法读取加密 ZIP。");
  if (symlink) throw new WeChatArchiveError("ZIP 包含符号链接。");
  if (directory) return false;

  const parts = filename.split("/");
  if (parts.length > 2 || parts.at(-1) !== transcriptName) return false;
  if (parts.length === 2 && ignoredDirectories.has(parts[0].toLowerCase())) return false;

  const fileType = (unixMode || 0) & 0o170000;
  if (fileType && fileType !== 0o100000) throw new WeChatArchiveError("ZIP 内的聊天记录不是普通文件。");
  return true;
}

function decodeTranscriptChunk(decoder, chunk, stream) {
  try {
    return decoder.decode(chunk, { stream });
  } catch {
    throw new WeChatArchiveError("ZIP 内的聊天记录不是有效的 UTF-8 文本。");
  }
}

async function readTranscript(entry) {
  if (entry.uncompressedSize > maxTranscriptBytes) throw new WeChatArchiveError(sizeError);
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
    throw new WeChatArchiveError("ZIP 内的聊天记录使用了不支持的压缩格式。");
  }

  let size = 0;
  let text = "";
  let decodeError = null;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const output = new WritableStream({
    write(chunk) {
      size += chunk.byteLength;
      if (size > maxTranscriptBytes) throw new WeChatArchiveError(sizeError);
      try {
        text += decodeTranscriptChunk(decoder, chunk, true);
      } catch (error) {
        // The final chunk is delivered from a transform flush, and some
        // runtimes let the sink error evaporate instead of rejecting the
        // pipe. Remember it so the real reason can still be reported.
        decodeError = error;
        throw error;
      }
    },
  });
  try {
    await entry.getData(output, { checkCrc32: true, checkOverlappingEntry: true, useWebWorkers: false });
  } catch (error) {
    // After the sink errors, closing the stream inside zip.js rejects with a
    // generic "WritableStream is closed" TypeError that hides the decode
    // failure. Prefer the captured reason, but keep genuine ZIP errors
    // (CRC, compressed size, and so on) as they are.
    if (decodeError && error instanceof TypeError) throw decodeError;
    throw error;
  }
  if (decodeError) throw decodeError;
  text += decodeTranscriptChunk(decoder, undefined, false);
  return { name: entry.filename, text };
}

export async function readWeChatArchive(file) {
  if (file.size > maxArchiveBytes) throw new Error("ZIP 超过 128 MB，请分批导出。");

  // ZIP filenames from WeChat may be UTF-8 even when the encoding flag is absent.
  const reader = new ZipReader(new BlobReader(file), { strictness: "strict", decodeText: decodeFilename });
  try {
    let candidate;
    let entryCount = 0;
    for await (const entry of reader.getEntriesGenerator()) {
      entryCount += 1;
      if (entryCount > maxEntries) throw new WeChatArchiveError("ZIP 文件太多，请分批导出。");
      if (!isTranscript(entry)) continue;
      if (candidate) throw new WeChatArchiveError("ZIP 中有多份聊天记录.txt，请单独导入。");
      candidate = entry;
    }
    if (!candidate) throw new WeChatArchiveError("ZIP 中找不到聊天记录.txt，请选择微信合并转发的归档。");
    return await readTranscript(candidate);
  } catch (error) {
    if (error instanceof WeChatArchiveError) throw error;
    if (error.message === ERR_UNSAFE_FILENAME) throw new Error("ZIP 包含不安全的文件路径。");
    if (error.message === ERR_AMBIGUOUS_ARCHIVE) throw new Error("ZIP 的结构存在冲突，无法确认要导入的聊天记录。");
    throw new Error("ZIP 已损坏或格式不受支持，无法读取聊天记录。");
  } finally {
    await reader.close();
  }
}
