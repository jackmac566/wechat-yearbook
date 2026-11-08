import { isChatArchive, parseImportArchive, parseImportText } from "../lib/import-file.js";

const parsing = () => self.postMessage({ phase: "parsing" });
const success = (result) => self.postMessage({ ok: true, result });
const failure = (error) => {
  const message = error instanceof SyntaxError ? "JSON 格式无效，请检查文件是否完整" : error.message;
  self.postMessage({ ok: false, error: message || "无法识别这个文件" });
};

self.onmessage = ({ data: { name, file } }) => {
  if (isChatArchive(name)) {
    parseImportArchive(file, parsing).then(success, failure);
    return;
  }
  const reader = new FileReader();
  reader.onprogress = ({ loaded, lengthComputable }) => {
    if (lengthComputable) self.postMessage({ phase: "reading", loaded });
  };
  reader.onerror = () => self.postMessage({ ok: false, error: "无法读取这个文件，请确认文件仍可访问" });
  reader.onload = () => {
    parsing();
    parseImportText(name, reader.result).then(success, failure);
  };
  reader.readAsText(file);
};
