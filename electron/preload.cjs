const { contextBridge } = require("electron");
const { version } = require("../package.json");

contextBridge.exposeInMainWorld("yearbookDesktop", {
  platform: process.platform,
  version,
});
