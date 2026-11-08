const { app, BrowserWindow, ipcMain, protocol, session, shell } = require("electron");
const { existsSync } = require("fs");
const fs = require("fs/promises");
const path = require("path");
const { pathToFileURL } = require("url");
const { createDocumentInbox } = require("./document-inbox.cjs");
const { developmentOrigin, isAllowedRendererRequest, isTrustedExternalUrl, productionOrigin, resolveAppPath } = require("./security.cjs");

const isDev = !app.isPackaged;

const experimentalShare = app.isPackaged && process.platform === "darwin"
  && existsSync(path.join(process.resourcesPath, "..", "PlugIns", "WeChatYearbookShare.appex"));
const inbox = createDocumentInbox(experimentalShare ? { cleanup: removeExperimentalShare } : {});
let desktopReady = false;
app.on("open-file", (event, filePath) => {
  if (!inbox.enqueue(filePath)) return;
  event.preventDefault();
  if (desktopReady) {
    const win = BrowserWindow.getAllWindows()[0] || createWindow();
    if (win.isVisible()) win.focus();
  }
});

protocol.registerSchemesAsPrivileged([{
  scheme: "app",
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}]);
app.enableSandbox();

function openTrustedExternal(rawUrl) {
  if (isTrustedExternalUrl(rawUrl)) void shell.openExternal(rawUrl, { activate: true });
}

function installAppProtocol() {
  const distRoot = path.resolve(__dirname, "..", "dist");
  // Only the main process uses this session to read validated bundled assets.
  const assetSession = session.fromPartition("yearbook-assets", { cache: false });
  protocol.handle("app", (request) => {
    const filePath = resolveAppPath(distRoot, request.url, request.method);
    if (!filePath) return new Response("Forbidden", { status: 403 });
    return assetSession.fetch(pathToFileURL(filePath).toString());
  });
}

function lockDownSession() {
  const currentSession = session.defaultSession;
  currentSession.setPermissionCheckHandler(() => false);
  currentSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  currentSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !isAllowedRendererRequest(details.url, isDev) }));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#f4f7f5",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: isDev,
      webviewTag: false,
    },
  });

  win.once("ready-to-show", () => win.show());
  const contents = win.webContents;
  const disconnect = () => inbox.disconnect(contents);
  contents.on("did-start-navigation", (details) => {
    if (details.isMainFrame && !details.isSameDocument) disconnect();
  });
  contents.on("render-process-gone", disconnect);
  contents.once("destroyed", disconnect);
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    openTrustedExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, rawUrl) => {
    const allowedOrigin = isDev ? developmentOrigin : productionOrigin;
    let isInternal = false;
    try {
      isInternal = new URL(rawUrl).origin === allowedOrigin;
    } catch {
      isInternal = false;
    }
    if (!isInternal) {
      event.preventDefault();
      openTrustedExternal(rawUrl);
    }
  });
  if (!isDev) {
    win.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12" || (input.alt && input.meta && input.key.toLowerCase() === "i") || (input.control && input.shift && input.key.toLowerCase() === "i")) event.preventDefault();
    });
  }

  if (isDev) win.loadURL(developmentOrigin);
  else win.loadURL(`${productionOrigin}/index.html`);
  return win;
}

function isImportSender({ sender, senderFrame }) {
  if (!senderFrame || senderFrame !== sender.mainFrame || !BrowserWindow.fromWebContents(sender)) return false;
  return isDev ? senderFrame.url.startsWith(`${developmentOrigin}/`) : senderFrame.url === `${productionOrigin}/index.html`;
}

ipcMain.on("yearbook-inbox-ready", (event) => {
  if (isImportSender(event)) inbox.connect(event.sender);
});
ipcMain.on("yearbook-inbox-complete", (event, id) => {
  if (isImportSender(event)) inbox.acknowledge(event.sender, id);
});

// Only the optional development extension creates disposable staging files.
async function removeExperimentalShare(filePath) {
  const folder = path.dirname(filePath);
  const stagedFolder = /^wechat-yearbook-share-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
  if (path.basename(filePath) !== "wechat-chat.zip" || !stagedFolder.test(path.basename(folder))) return;
  const temp = await fs.realpath(app.getPath("temp"));
  const actualFolder = await fs.realpath(folder);
  if (actualFolder !== path.join(temp, path.basename(folder))) return;
  await fs.unlink(path.join(actualFolder, "wechat-chat.zip"));
  await fs.rmdir(actualFolder);
}

app.whenReady().then(() => {
  if (!isDev) installAppProtocol();
  lockDownSession();
  desktopReady = true;
  for (const argument of process.argv.slice(1)) {
    if (!argument.startsWith("-")) inbox.enqueue(argument);
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
