import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { hardenInfoPlist } = require("../scripts/after-pack.cjs");
const { isAllowedRendererRequest, isTrustedExternalUrl, resolveAppPath } = require("../electron/security.cjs");

test("removes unused macOS permission declarations from packaged metadata", () => {
  const result = hardenInfoPlist({
    NSCameraUsageDescription: "camera",
    NSMicrophoneUsageDescription: "microphone",
    NSBluetoothAlwaysUsageDescription: "bluetooth",
    NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
  });
  assert.equal(result.NSCameraUsageDescription, undefined);
  assert.equal(result.NSMicrophoneUsageDescription, undefined);
  assert.equal(result.NSBluetoothAlwaysUsageDescription, undefined);
  assert.deepEqual(result.NSAppTransportSecurity, { NSAllowsArbitraryLoads: false });
  assert.equal(result.LSFileQuarantineEnabled, true);
});

test("desktop shell uses an isolated custom protocol and denies system permissions", () => {
  const source = fs.readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const policySource = fs.readFileSync(new URL("../electron/security.cjs", import.meta.url), "utf8");
  assert.match(source, /app\.enableSandbox\(\)/);
  assert.match(source, /setPermissionRequestHandler/);
  assert.match(source, /setPermissionCheckHandler/);
  assert.match(source, /webRequest\.onBeforeRequest/);
  assert.match(source, /contextIsolation: true/);
  assert.match(source, /nodeIntegration: false/);
  assert.match(source, /webviewTag: false/);
  assert.doesNotMatch(source, /preload:/);
  assert.match(policySource, /app:\/\/yearbook/);
  assert.doesNotMatch(source, /url\.startsWith\("file:"\)/);
});

test("desktop URL policy blocks untrusted websites and local path traversal", () => {
  assert.equal(isTrustedExternalUrl("https://github.com/example/repo"), true);
  assert.equal(isTrustedExternalUrl("http://github.com/example/repo"), false);
  assert.equal(isTrustedExternalUrl("https://github.com.evil.example/repo"), false);
  assert.equal(isTrustedExternalUrl("https://evil.example/"), false);
  assert.equal(isAllowedRendererRequest("https://example.com/upload", false), false);
  assert.equal(isAllowedRendererRequest("file:///Users/me/secret.txt", false), false);
  assert.equal(isAllowedRendererRequest("app://yearbook/assets/app.js", false), true);
  const distRoot = path.resolve("safe", "dist");
  assert.equal(resolveAppPath(distRoot, "app://yearbook/index.html"), path.join(distRoot, "index.html"));
  assert.equal(resolveAppPath(distRoot, "app://yearbook/%2e%2e/secret.txt"), null);
  assert.equal(resolveAppPath(distRoot, "app://attacker/index.html"), null);
});
