import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { APP_VERSION } from "../src/version.js";

const read = (path) => readFileSync(path, "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const changelog = read("CHANGELOG.md");
const workflow = read(".github/workflows/release.yml");
const desktopMain = read("electron/main.cjs");
const releaseNotes = `docs/releases/v${pkg.version}.md`;

assert.match(pkg.version, /^\d+\.\d+\.\d+$/, "package.json version 必须是 x.y.z");
assert.equal(APP_VERSION, pkg.version, "src/version.js 与 package.json 版本不一致");
assert.equal(lock.version, pkg.version, "package-lock.json 与 package.json 版本不一致");
assert.equal(lock.packages[""].version, pkg.version, "依赖锁根包版本不一致");
assert.ok(changelog.includes(`## V${pkg.version} —`), "CHANGELOG 缺少当前版本");
assert.equal(pkg.build.artifactName, "WeChat-Yearbook-${version}-${os}-${arch}.${ext}", "安装包文件名必须带系统和架构");
assert.match(pkg.scripts["dist:mac"], /--mac dmg zip --arm64 --publish=never$/, "Mac 候选必须构建 arm64 DMG 与 ZIP");
assert.match(workflow, /^    runs-on: macos-15$/m, "Mac 候选使用 macos-15 构建");
assert.match(workflow, /^  workflow_dispatch:$/m, "Mac 候选需要手动启动");
assert.doesNotMatch(workflow, /^  (?:push|pull_request|release|schedule|workflow_call):/m, "Mac 候选仅允许手动启动");
assert.doesNotMatch(workflow, /gh\s+release|contents:\s*write/, "Mac 候选工作流只生成附件");
assert.ok(workflow.includes("npm audit --audit-level=high"), "Release 构建缺少依赖审计");
assert.ok(workflow.includes("SHA256SUMS.txt"), "Release 缺少校验和生成");
assert.ok(workflow.includes("attest-build-provenance@"), "Release 缺少构建来源证明");
assert.ok(workflow.includes("npm run verify:packaged"), "Release 缺少安装包安全熔断检查");
assert.ok(existsSync(releaseNotes), `缺少 ${releaseNotes}`);
assert.equal(pkg.build.electronFuses?.runAsNode, false, "生产包必须关闭 ELECTRON_RUN_AS_NODE");
assert.equal(pkg.build.electronFuses?.enableEmbeddedAsarIntegrityValidation, true, "生产包必须启用 ASAR 完整性校验");
assert.equal(pkg.build.electronFuses?.onlyLoadAppFromAsar, true, "生产包必须只从 ASAR 加载代码");
assert.ok(desktopMain.includes("app.enableSandbox()"), "Electron 主进程必须启用全局沙箱");
assert.ok(desktopMain.includes("setPermissionRequestHandler"), "Electron 主进程必须拒绝未使用的系统权限");
assert.ok(existsSync("build/icon.png"), "缺少桌面图标 build/icon.png");

console.log(`release-metadata=ok version=${pkg.version}`);
