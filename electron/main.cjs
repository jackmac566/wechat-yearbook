const { app, BrowserWindow, net, protocol, session, shell } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { developmentOrigin, isAllowedRendererRequest, isTrustedExternalUrl, productionOrigin, resolveAppPath } = require("./security.cjs");

const isDev = !app.isPackaged;

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
  protocol.handle("app", (request) => {
    const filePath = resolveAppPath(distRoot, request.url, request.method);
    if (!filePath) return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(filePath).toString());
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
}

app.whenReady().then(() => {
  if (!isDev) installAppProtocol();
  lockDownSession();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
