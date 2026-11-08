#!/bin/bash
# 编译微信年轮 Mac 共享扩展（无需 Xcode，用命令行工具自带 SDK）。
# 产物：build/mac-share-extension/WeChatYearbookShare.appex
set -euo pipefail
cd "$(dirname "$0")"

BUNDLE="WeChatYearbookShare.appex"
SDK="$(xcrun --show-sdk-path)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

clang -fobjc-arc -fmodules -arch arm64 -arch x86_64 -isysroot "$SDK" -mmacosx-version-min=14.0 \
  -framework Cocoa \
  -e _NSExtensionMain \
  YearbookShareViewController.m \
  -o "$TMP/WeChatYearbookShare"

rm -rf "$BUNDLE"
mkdir -p "$BUNDLE/Contents/MacOS"
cp "$TMP/WeChatYearbookShare" "$BUNDLE/Contents/MacOS/WeChatYearbookShare"
cp Info.plist "$BUNDLE/Contents/Info.plist"
codesign --force --sign - "$BUNDLE" >/dev/null

echo "built $BUNDLE"
