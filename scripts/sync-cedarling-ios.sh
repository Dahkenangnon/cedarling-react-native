#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$PROJECT_DIR/ios"
PIN_FILE="$IOS_DIR/cedarling-native/PINNED_REVISION"
MINIMUM_IOS_VERSION="16.4"
ALLOW_DIRTY=false
JANS_REPO=""

usage() {
  echo "Usage: scripts/sync-cedarling-ios.sh [--allow-dirty] [JANS_REPO]" >&2
}

while (( $# > 0 )); do
  case "$1" in
    --allow-dirty)
      ALLOW_DIRTY=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
    *)
      if [[ -n "$JANS_REPO" ]]; then
        echo "Only one Jans checkout may be supplied" >&2
        usage
        exit 2
      fi
      JANS_REPO="$1"
      ;;
  esac
  shift
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Cedarling iOS artifacts must be synchronized on macOS" >&2
  exit 1
fi
if [[ -z "$JANS_REPO" ]]; then
  JANS_REPO="${CEDARLING_JANS_REPO:-}"
fi
if [[ -z "$JANS_REPO" ]]; then
  echo "Supply a Jans checkout argument or CEDARLING_JANS_REPO" >&2
  exit 2
fi

for command in cargo git make node rustup xcodebuild; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command is unavailable: $command" >&2
    exit 1
  fi
done

JANS_REPO="$(cd -- "$JANS_REPO" && pwd)"
if ! git -C "$JANS_REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a Jans Git checkout: $JANS_REPO" >&2
  exit 1
fi

BINDING_DIR="$JANS_REPO/jans-cedarling/bindings/cedarling_uniffi"
if [[ ! -d "$BINDING_DIR" ]]; then
  echo "Missing jans-cedarling/bindings/cedarling_uniffi in $JANS_REPO" >&2
  exit 1
fi

CURRENT_REVISION="$(git -C "$JANS_REPO" rev-parse HEAD)"
PINNED_REVISION="$(tr -d '[:space:]' < "$PIN_FILE")"
if [[ "$CURRENT_REVISION" != "$PINNED_REVISION" ]]; then
  echo "Jans checkout revision $CURRENT_REVISION does not match $PINNED_REVISION" >&2
  exit 1
fi
if [[ "$ALLOW_DIRTY" != true ]] && [[ -n "$(git -C "$JANS_REPO" status --porcelain --untracked-files=all)" ]]; then
  echo "Jans checkout is dirty; use a clean checkout or explicitly pass --allow-dirty" >&2
  exit 1
fi

LIB_RS="$BINDING_DIR/src/lib.rs"
for symbol in load_from_json load_from_json_with_archive_bytes authorize_unsigned authorize_multi_issuer; do
  if ! grep -q "pub fn $symbol" "$LIB_RS"; then
    echo "Pinned source is missing required API: $symbol" >&2
    exit 1
  fi
done
if ! grep -q 'aarch64-apple-ios-sim' "$BINDING_DIR/Makefile" ||
   ! grep -q 'aarch64-apple-ios' "$BINDING_DIR/Makefile"; then
  echo "Pinned Makefile is missing the required Apple targets" >&2
  exit 1
fi

rustup toolchain install 1.95.0 --profile minimal
rustup target add --toolchain 1.95.0 aarch64-apple-ios aarch64-apple-ios-sim

export RUSTUP_TOOLCHAIN=1.95.0

(
  cd "$BINDING_DIR"
  make build BUILD_TYPE=release
  IPHONEOS_DEPLOYMENT_TARGET="$MINIMUM_IOS_VERSION" \
    cargo build --release -p cedarling_uniffi --target=aarch64-apple-ios-sim
  IPHONEOS_DEPLOYMENT_TARGET="$MINIMUM_IOS_VERSION" \
    cargo build --release -p cedarling_uniffi --target=aarch64-apple-ios
  make ios-bindings BUILD_TYPE=release
  make ios-xcframework BUILD_TYPE=release
)

UPSTREAM_FRAMEWORK="$BINDING_DIR/ios/Mobile.xcframework"
UPSTREAM_SWIFT="$BINDING_DIR/build/cedarling_uniffi.swift"
if [[ ! -d "$UPSTREAM_FRAMEWORK" || ! -f "$UPSTREAM_SWIFT" ]]; then
  echo "Pinned build did not produce the expected XCFramework and Swift binding" >&2
  exit 1
fi
if ! grep -q 'public class Cedarling' "$UPSTREAM_SWIFT"; then
  echo "Generated Swift binding is missing Cedarling" >&2
  exit 1
fi
if ! find "$UPSTREAM_FRAMEWORK" -type f -name module.modulemap -print -quit | grep -q .; then
  echo "Generated XCFramework is missing module.modulemap" >&2
  exit 1
fi

STAGING_DIR="$(mktemp -d)"
trap 'rm -rf -- "$STAGING_DIR"' EXIT
mkdir -p "$STAGING_DIR/generated"
ditto "$UPSTREAM_FRAMEWORK" "$STAGING_DIR/CedarlingNative.xcframework"
install -m 0644 "$UPSTREAM_SWIFT" "$STAGING_DIR/generated/cedarling_uniffi.swift"

rm -rf -- "$IOS_DIR/CedarlingNative.xcframework"
mkdir -p "$IOS_DIR/generated" "$IOS_DIR/cedarling-native"
ditto "$STAGING_DIR/CedarlingNative.xcframework" "$IOS_DIR/CedarlingNative.xcframework"
install -m 0644 "$STAGING_DIR/generated/cedarling_uniffi.swift" \
  "$IOS_DIR/generated/cedarling_uniffi.swift"

RELEASE_TAG="$(git -C "$JANS_REPO" describe --tags --exact-match 2>/dev/null || printf 'unreleased')"
CEDARLING_REVISION="$CURRENT_REVISION" \
CEDARLING_RELEASE_TAG="$RELEASE_TAG" \
CEDARLING_GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
CEDARLING_RUST_VERSION="$(rustc --version)" \
CEDARLING_XCODE_VERSION="$(xcodebuild -version | tr '\n' ' ')" \
CEDARLING_MACOS_VERSION="$(sw_vers -productVersion) ($(sw_vers -buildVersion))" \
CEDARLING_MINIMUM_IOS_VERSION="$MINIMUM_IOS_VERSION" \
  node "$PROJECT_DIR/scripts/write-ios-provenance.mjs"

"$PROJECT_DIR/scripts/verify-ios-artifacts.sh" --native-only
echo "Synchronized Cedarling iOS artifacts from $CURRENT_REVISION"
