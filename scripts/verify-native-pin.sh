#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

ANDROID_PIN="$(tr -d '[:space:]' < "$PROJECT_DIR/android/cedarling-native/PINNED_REVISION")"
IOS_PIN="$(tr -d '[:space:]' < "$PROJECT_DIR/ios/cedarling-native/PINNED_REVISION")"

if [[ ! "$ANDROID_PIN" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Android Cedarling pin is not a full Git commit SHA" >&2
  exit 1
fi
if [[ "$ANDROID_PIN" != "$IOS_PIN" ]]; then
  echo "Android and iOS Cedarling revisions differ" >&2
  echo "Android: $ANDROID_PIN" >&2
  echo "iOS:     $IOS_PIN" >&2
  exit 1
fi

echo "Android and iOS Cedarling pins match: $ANDROID_PIN"
