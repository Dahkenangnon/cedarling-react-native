#!/usr/bin/env bash
set -euo pipefail

EXAMPLE_KIND="${1:-}"
PROJECT_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
ARTIFACT_ROOT="${RUNNER_TEMP:-/tmp}/cedarling-android-${EXAMPLE_KIND}"
UI_XML="$ARTIFACT_ROOT/window.xml"
SUCCESS_SCREENSHOT="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}-success.png"
FAILURE_SCREENSHOT="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}-failure.png"
VIDEO_LOCAL="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}.mp4"
VIDEO_LOG="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}-video-render.txt"
VIDEO_FRAMES="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}-video-frames"
LOGCAT="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}-logcat.txt"
SCREENSHOT_STATS="$ARTIFACT_ROOT/android-${EXAMPLE_KIND}-screenshot-stats.txt"

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
rm -f "$VIDEO_LOCAL" "$VIDEO_LOG"

capture_diagnostics() {
  local exit_status=$?

  adb logcat -d > "$LOGCAT" || true
  if ((exit_status != 0)); then
    adb exec-out screencap -p > "$FAILURE_SCREENSHOT" || true
  fi
  return "$exit_status"
}
trap capture_diagnostics EXIT

wake_display() {
  adb shell settings put system screen_off_timeout 2147483647
  adb shell svc power stayon true
  adb shell input keyevent KEYCODE_WAKEUP
  adb shell wm dismiss-keyguard || true
  sleep 1
}

capture_success_screenshot() {
  local attempt=""

  for attempt in $(seq 1 3); do
    wake_display
    adb exec-out screencap -p > "$SUCCESS_SCREENSHOT"
    if node "$PROJECT_DIR/scripts/verify-evidence-image.mjs" \
      "$SUCCESS_SCREENSHOT" > "$SCREENSHOT_STATS" 2>&1; then
      return 0
    fi
    echo "Android screenshot validation failed on attempt $attempt" >&2
    sleep 2
  done

  cat "$SCREENSHOT_STATS" >&2
  return 1
}

render_evidence_video() {
  local frame_index=""
  local frame_path=""

  command -v ffmpeg >/dev/null
  mkdir -p "$VIDEO_FRAMES"
  wake_display

  for frame_index in $(seq 1 16); do
    printf -v frame_path '%s/frame-%03d.png' "$VIDEO_FRAMES" "$frame_index"
    adb exec-out screencap -p > "$frame_path"
    test -s "$frame_path"
    sleep 0.25
  done

  ffmpeg \
    -hide_banner \
    -loglevel info \
    -y \
    -framerate 4 \
    -i "$VIDEO_FRAMES/frame-%03d.png" \
    -vf 'scale=trunc(iw/2)*2:trunc(ih/2)*2' \
    -c:v libx264 \
    -preset veryfast \
    -pix_fmt yuv420p \
    -movflags +faststart \
    "$VIDEO_LOCAL" > "$VIDEO_LOG" 2>&1
  test -s "$VIDEO_LOCAL"
}

dump_ui() {
  adb shell uiautomator dump /sdcard/cedarling-window.xml >/dev/null
  adb exec-out cat /sdcard/cedarling-window.xml > "$UI_XML"
}

find_bounds() {
  local label="$1"
  node "$PROJECT_DIR/scripts/android-ui-bounds.mjs" "$UI_XML" text "$label"
}

find_resource_bounds() {
  local resource_id="$1"
  node "$PROJECT_DIR/scripts/android-ui-bounds.mjs" "$UI_XML" resource-id "$resource_id"
}

dismiss_transient_anr() {
  local bounds=""
  local wait_x=""
  local wait_y=""

  if ! grep -Fq 'resource-id="android:id/aerr_wait"' "$UI_XML"; then
    return 1
  fi

  bounds="$(find_resource_bounds "android:id/aerr_wait")"
  if [[ -z "$bounds" ]]; then
    return 1
  fi

  read -r wait_x wait_y <<<"$bounds"
  echo "Dismissing transient Android ANR dialog" >&2
  adb shell input tap "$wait_x" "$wait_y"
  sleep 3
}

scroll_to_text() {
  local label="$1"
  local bounds=""
  for _ in $(seq 1 14); do
    dump_ui
    if dismiss_transient_anr; then
      continue
    fi
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
wake_display
adb shell am start -W -n "$APP_ID/$ACTIVITY"

button_bounds="$(scroll_to_text "Run native smoke tests")"
read -r button_x button_y <<<"$button_bounds"
adb shell input tap "$button_x" "$button_y"

passed=false
for _ in $(seq 1 45); do
  dump_ui
  if dismiss_transient_anr; then
    continue
  fi
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
grep -Fq 'text="PASS"' "$UI_XML"
grep -Fq 'text="ALLOW request: ALLOW · DENY request: DENY"' "$UI_XML"
capture_success_screenshot
render_evidence_video

echo "Android $EXAMPLE_KIND JavaScript-to-Rust smoke test passed"
