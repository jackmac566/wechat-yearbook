// 沙箱桥仅接收用户从系统打开的文件。等待导入处理完成再确认投递。
const { contextBridge, ipcRenderer } = require("electron");

let callback = null;
let pending = null;

function deliver() {
  if (!callback || !pending) return;
  const listener = callback;
  const { id, files } = pending;
  pending = null;
  const complete = () => ipcRenderer.send("yearbook-inbox-complete", id);
  Promise.resolve().then(() => listener(files)).then(complete, complete);
}

ipcRenderer.on("yearbook-inbox-files", (_event, id, files) => {
  pending = { id, files };
  deliver();
});

contextBridge.exposeInMainWorld("yearbookInbox", {
  onFiles: (next) => {
    if (typeof next !== "function") throw new TypeError("导入监听器无效");
    callback = next;
    ipcRenderer.send("yearbook-inbox-ready");
    deliver();
    return () => {
      if (callback === next) callback = null;
    };
  },
});
