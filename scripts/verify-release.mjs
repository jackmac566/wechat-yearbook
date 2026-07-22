import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const pkg = JSON.parse(read("package.json"));
const versionSource = read("src/version.js");
const changelog = read("CHANGELOG.md");
const workflow = read(".github/workflows/release.yml");

assert.match(pkg.version, /^\d+\.\d+\.\d+$/, "package.json version 必须是 x.y.z");
assert.ok(versionSource.includes(`APP_VERSION = "${pkg.version}"`), "src/version.js 与 package.json 版本不一致");
assert.ok(changelog.includes(`## V${pkg.version} —`), "CHANGELOG 缺少当前版本");
assert.equal(pkg.build.artifactName, "WeChat-Yearbook-${version}-${os}-${arch}.${ext}", "安装包文件名必须带系统和架构");
assert.ok(workflow.includes("macos-14"), "缺少 Apple 芯片 Mac 构建");
assert.ok(workflow.includes("macos-15-intel"), "缺少 Intel Mac 构建");
assert.ok(workflow.includes("windows-latest"), "缺少 Windows 构建");
assert.ok(existsSync("build/icon.png"), "缺少桌面图标 build/icon.png");

console.log(`release-metadata=ok version=${pkg.version}`);
