#!/usr/bin/env bash
set -euo pipefail

logcat_path="${RUNNER_TEMP:?RUNNER_TEMP must be set}/android-logcat.txt"

capture_logcat() {
  adb logcat -d > "$logcat_path" || true
}

trap capture_logcat EXIT

adb shell getprop ro.product.cpu.abilist
adb shell getconf PAGE_SIZE

cd example/android
NODE_ENV=test ./gradlew \
  :cedarling-react-native:connectedDebugAndroidTest \
  -PcedarlingInstrumentationAbi=x86_64 \
  -PreactNativeArchitectures=x86_64 \
  --stacktrace
