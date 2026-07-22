const fs = require("fs");
const path = require("path");
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
  return info;
}

async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const infoPath = path.join(context.appOutDir, appName, "Contents", "Info.plist");
  const info = plist.parse(fs.readFileSync(infoPath, "utf8"));
  fs.writeFileSync(infoPath, plist.build(hardenInfoPlist(info)), "utf8");
}

exports.default = afterPack;
exports.hardenInfoPlist = hardenInfoPlist;
