const path = require("path");

const productionOrigin = "app://yearbook";
const developmentOrigin = "http://127.0.0.1:5173";
const trustedExternalHosts = new Set(["github.com"]);

function isTrustedExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && trustedExternalHosts.has(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function resolveAppPath(distRoot, rawUrl, method = "GET") {
  try {
    if (/%2e|%2f|%5c/i.test(rawUrl)) return null;
    const url = new URL(rawUrl);
    if (url.protocol !== "app:" || url.host !== "yearbook" || method !== "GET") return null;
    const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = path.resolve(distRoot, `.${requestedPath}`);
    return filePath === distRoot || filePath.startsWith(`${distRoot}${path.sep}`) ? filePath : null;
  } catch {
    return null;
  }
}

function isAllowedRendererRequest(rawUrl, isDev) {
  try {
    const url = new URL(rawUrl);
    return ["blob:", "data:"].includes(url.protocol)
      || (!isDev && url.protocol === "app:" && url.host === "yearbook")
      || (isDev && [developmentOrigin, "ws://127.0.0.1:5173"].includes(url.origin));
  } catch {
    return false;
  }
}

module.exports = { developmentOrigin, isAllowedRendererRequest, isTrustedExternalUrl, productionOrigin, resolveAppPath };
