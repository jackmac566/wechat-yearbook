import { parseImport } from "../lib/parser.js";

self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ ok: true, dataset: parseImport(data.name, await data.file.text()) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : "无法识别这个文件" });
  }
};
