#!/usr/bin/env bash
set -euo pipefail

EXAMPLE_KIND="${1:-}"
PROJECT_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
ARTIFACT_ROOT="${RUNNER_TEMP:-/tmp}/cedarling-android-${EXAMPLE_KIND}"
UI_XML="$ARTIFACT_ROOT/window.xml"
SUCCESS_SCREENSHOT="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}-success.png"
FAILURE_SCREENSHOT="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}-failure.png"
VIDEO_DEVICE="/sdcard/cedarling-${EXAMPLE_KIND}.mp4"
VIDEO_LOCAL="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}.mp4"
LOGCAT="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}-logcat.txt"

case "$EXAMPLE_KIND" in
  expo)
    ANDROID_DIR="$PROJECT_DIR/example/android"
    APP_ID="expo.modules.cedarling.example"
    ACTIVITY=".MainActivity"
    APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
    ;;
  bare)
    ANDROID_DIR="$PROJECT_DIR/bare-example/android"
    APP_ID="com.cedarlingbareexample"
    ACTIVITY=".MainActivity"
    APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
    ;;
  *)
    echo "Usage: scripts/run-android-ui-smoke.sh <expo|bare>" >&2
    exit 2
    ;;
esac

mkdir -p "$ARTIFACT_ROOT"

capture_diagnostics() {
  adb logcat -d > "$LOGCAT" || true
  if [[ ! -s "$SUCCESS_SCREENSHOT" ]]; then
    adb exec-out screencap -p > "$FAILURE_SCREENSHOT" || true
  fi
  adb shell pkill -INT screenrecord >/dev/null 2>&1 || true
  sleep 1
  adb pull "$VIDEO_DEVICE" "$VIDEO_LOCAL" >/dev/null 2>&1 || true
}
trap capture_diagnostics EXIT

dump_ui() {
  adb shell uiautomator dump /sdcard/cedarling-window.xml >/dev/null
  adb exec-out cat /sdcard/cedarling-window.xml > "$UI_XML"
}

find_bounds() {
  local label="$1"
  UI_XML_PATH="$UI_XML" UI_LABEL="$label" node <<'NODE'
const fs = require('node:fs');
const xml = fs.readFileSync(process.env.UI_XML_PATH, 'utf8');
const escaped = process.env.UI_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const element = xml.match(new RegExp('<node\\b(?=[^>]*\\btext="' + escaped + '")[^>]*>'));
const bounds = element?.[0].match(/bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"/);
if (bounds) {
  const x = Math.round((Number(bounds[1]) + Number(bounds[3])) / 2);
  const y = Math.round((Number(bounds[2]) + Number(bounds[4])) / 2);
  process.stdout.write(x + ' ' + y);
}
NODE
}

scroll_to_text() {
  local label="$1"
  local bounds=""
  for _ in $(seq 1 14); do
    dump_ui
    bounds="$(find_bounds "$label")"
    if [[ -n "$bounds" ]]; then
      printf '%s' "$bounds"
      return 0
    fi
    adb shell input swipe 500 1550 500 450 350
  done
  echo "Unable to find Android UI text: $label" >&2
  return 1
}

cd "$ANDROID_DIR"
NODE_ENV=test ./gradlew \
  :cedarling-react-native:connectedDebugAndroidTest \
  -PcedarlingInstrumentationAbi=x86_64 \
  -PreactNativeArchitectures=x86_64 \
  --stacktrace
NODE_ENV=production ./gradlew :app:assembleRelease --stacktrace
test -s "$APK"

adb install -r "$APK"
adb shell am force-stop "$APP_ID"
adb logcat -c
adb shell rm -f "$VIDEO_DEVICE"
adb shell screenrecord --size 720x1280 --bit-rate 3000000 --time-limit 120 "$VIDEO_DEVICE" >/dev/null 2>&1 &
adb shell am start -W -n "$APP_ID/$ACTIVITY"

read -r button_x button_y <<<"$(scroll_to_text "Run native smoke tests")"
adb shell input tap "$button_x" "$button_y"

passed=false
for _ in $(seq 1 45); do
  dump_ui
  if grep -Fq 'text="PASS"' "$UI_XML" &&
     grep -Fq 'text="ALLOW request: ALLOW · DENY request: DENY"' "$UI_XML"; then
    passed=true
    break
  fi
  adb shell input swipe 500 1500 500 850 250
  sleep 2
done
if [[ "$passed" != true ]]; then
  echo "Cedarling JavaScript-to-Rust smoke test did not reach PASS" >&2
  exit 1
fi

scroll_to_text "ALLOW request: ALLOW · DENY request: DENY" >/dev/null
dump_ui
adb exec-out screencap -p > "$SUCCESS_SCREENSHOT"
test -s "$SUCCESS_SCREENSHOT"
grep -Fq 'text="PASS"' "$UI_XML"
grep -Fq 'text="ALLOW request: ALLOW · DENY request: DENY"' "$UI_XML"

echo "Android $EXAMPLE_KIND JavaScript-to-Rust smoke test passed"
