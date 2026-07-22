import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { FuseV1Options, getCurrentFuseWire } from "@electron/fuses";

const require = createRequire(import.meta.url);
const { extractFile, listPackage } = require("@electron/asar");
const root = path.resolve(process.argv[2] || "release");
const sourceMetadata = JSON.parse(fs.readFileSync("package.json", "utf8"));

function findPackagedApp(directory, depth = 0) {
  if (depth > 4 || !fs.existsSync(directory)) return null;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app") && fs.existsSync(path.join(target, "Contents", "Resources", "app.asar"))) {
      return { executable: target, asar: path.join(target, "Contents", "Resources", "app.asar") };
    }
    if (entry.isDirectory() && /(?:win|linux)-unpacked$/i.test(entry.name)) {
      const expectedExecutable = entry.name.toLowerCase().startsWith("win") ? `${sourceMetadata.build.productName}.exe` : sourceMetadata.name;
      const executable = fs.readdirSync(target).find((name) => name.toLowerCase() === expectedExecutable.toLowerCase());
      if (executable && fs.existsSync(path.join(target, "resources", "app.asar"))) {
        return { executable: path.join(target, executable), asar: path.join(target, "resources", "app.asar") };
      }
    }
    if (entry.isDirectory()) {
      const found = findPackagedApp(target, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const packaged = findPackagedApp(root);
assert.ok(packaged, `在 ${root} 中没有找到已装配的桌面应用`);

const wire = await getCurrentFuseWire(packaged.executable);
const disabled = 48;
const enabled = 49;
assert.equal(wire[FuseV1Options.RunAsNode], disabled, "RunAsNode 未关闭");
assert.equal(wire[FuseV1Options.EnableCookieEncryption], enabled, "Cookie 加密未开启");
assert.equal(wire[FuseV1Options.EnableNodeOptionsEnvironmentVariable], disabled, "NODE_OPTIONS 未关闭");
assert.equal(wire[FuseV1Options.EnableNodeCliInspectArguments], disabled, "Node 调试参数未关闭");
assert.equal(wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation], enabled, "ASAR 完整性校验未开启");
assert.equal(wire[FuseV1Options.OnlyLoadAppFromAsar], enabled, "未限制为只从 ASAR 加载");
assert.equal(wire[FuseV1Options.GrantFileProtocolExtraPrivileges], disabled, "file:// 额外权限未关闭");

const entries = listPackage(packaged.asar);
for (const required of ["/dist/index.html", "/electron/main.cjs", "/electron/security.cjs", "/package.json"]) {
  assert.ok(entries.includes(required), `安装包缺少 ${required}`);
}
for (const forbidden of ["/tests", "/scripts", "/.github", "/electron/preload.cjs"]) {
  assert.ok(!entries.some((entry) => entry === forbidden || entry.startsWith(`${forbidden}/`)), `安装包不应包含 ${forbidden}`);
}
assert.ok(!entries.some((entry) => /\.(?:db|sqlite|wcdb|pem|p12|key)$/i.test(entry)), "安装包含敏感数据库或密钥文件");

const packagedMetadata = JSON.parse(extractFile(packaged.asar, "package.json").toString("utf8"));
assert.equal(packagedMetadata.version, sourceMetadata.version, "安装包版本与源码不一致");

console.log(`packaged-security=ok version=${packagedMetadata.version} app=${packaged.executable}`);
