const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const plist = require("plist");

const unusedPermissionKeys = [
  "NSAppleEventsUsageDescription",
  "NSBluetoothAlwaysUsageDescription",
  "NSBluetoothPeripheralUsageDescription",
  "NSCalendarsUsageDescription",
  "NSCameraUsageDescription",
  "NSContactsUsageDescription",
  "NSLocationWhenInUseUsageDescription",
  "NSMicrophoneUsageDescription",
  "NSPhotoLibraryUsageDescription",
  "NSRemindersUsageDescription",
];

function hardenInfoPlist(info) {
  for (const key of unusedPermissionKeys) delete info[key];
  info.NSAppTransportSecurity = { NSAllowsArbitraryLoads: false };
  info.LSFileQuarantineEnabled = true;
  info.CFBundleDocumentTypes = [{
    CFBundleTypeName: "微信聊天转发文件",
    CFBundleTypeRole: "Viewer",
    LSHandlerRank: "Alternate",
    LSItemContentTypes: ["public.zip-archive", "public.plain-text"],
  }];
  return info;
}

async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appBundle = path.join(context.appOutDir, appName);
  const infoPath = path.join(appBundle, "Contents", "Info.plist");
  const info = plist.parse(fs.readFileSync(infoPath, "utf8"));
  fs.writeFileSync(infoPath, plist.build(hardenInfoPlist(info)), "utf8");

  const appexName = "WeChatYearbookShare.appex";
  const pluginsDir = path.join(appBundle, "Contents", "PlugIns");
  const appexTarget = path.join(pluginsDir, appexName);
  fs.rmSync(appexTarget, { recursive: true, force: true });
  if (process.env.YEARBOOK_EXPERIMENTAL_SHARE_EXTENSION !== "1") return;

  const source = path.resolve(__dirname, "..", "build", "mac-share-extension");
  execFileSync("/bin/bash", [path.join(source, "build.sh")], { stdio: "inherit" });
  fs.mkdirSync(pluginsDir, { recursive: true });
  fs.cpSync(path.join(source, appexName), appexTarget, { recursive: true });
}

exports.default = afterPack;
exports.hardenInfoPlist = hardenInfoPlist;
