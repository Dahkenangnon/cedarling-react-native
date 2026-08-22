#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$PROJECT_DIR/ios"
PIN_FILE="$IOS_DIR/cedarling-native/PINNED_REVISION"
MINIMUM_IOS_VERSION="17.5"
PINNED_RELEASE_TAG="v2.3.0"
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

for command in cargo git make node protoc rustup xcodebuild xcrun; do
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
TAG_REVISION="$(git -C "$JANS_REPO" rev-parse --verify "${PINNED_RELEASE_TAG}^{commit}" 2>/dev/null || true)"
if [[ -n "$TAG_REVISION" && "$TAG_REVISION" != "$CURRENT_REVISION" ]]; then
  echo "$PINNED_RELEASE_TAG resolves to $TAG_REVISION instead of $CURRENT_REVISION" >&2
  exit 1
fi
if [[ "$ALLOW_DIRTY" != true ]] && [[ -n "$(git -C "$JANS_REPO" status --porcelain --untracked-files=all)" ]]; then
  echo "Jans checkout is dirty; use a clean checkout or explicitly pass --allow-dirty" >&2
  exit 1
fi

LIB_RS="$BINDING_DIR/src/lib.rs"
APPLE_CONFIG="$JANS_REPO/jans-cedarling/.cargo/config.toml"
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
for apple_config_line in \
  'CFLAGS_aarch64_apple_ios = "-miphoneos-version-min=17.5"' \
  'CXXFLAGS_aarch64_apple_ios = "-miphoneos-version-min=17.5"' \
  'rustflags = ["-C", "link-arg=-miphoneos-version-min=17.5"]' \
  'CFLAGS_aarch64_apple_ios_sim = "-mios-simulator-version-min=17.5"' \
  'CXXFLAGS_aarch64_apple_ios_sim = "-mios-simulator-version-min=17.5"' \
  'rustflags = ["-C", "link-arg=-mios-simulator-version-min=17.5"]'; do
  if ! grep -Fqx -- "$apple_config_line" "$APPLE_CONFIG"; then
    echo "Pinned Apple build configuration is missing: $apple_config_line" >&2
    exit 1
  fi
done

rustup toolchain install 1.95.0 --profile minimal
rustup target add --toolchain 1.95.0 aarch64-apple-ios aarch64-apple-ios-sim

export RUSTUP_TOOLCHAIN=1.95.0

(
  cd "$BINDING_DIR"
  make build BUILD_TYPE=release CARGO_FLAGS='--release --locked'
  IPHONEOS_DEPLOYMENT_TARGET="$MINIMUM_IOS_VERSION" \
    cargo build --release --locked -p cedarling_uniffi --target=aarch64-apple-ios-sim
  IPHONEOS_DEPLOYMENT_TARGET="$MINIMUM_IOS_VERSION" \
    cargo build --release --locked -p cedarling_uniffi --target=aarch64-apple-ios
  for target in aarch64-apple-ios-sim aarch64-apple-ios; do
    library="../../target/$target/release/libcedarling_uniffi.a"
    xcrun strip -S "$library"
    xcrun ranlib "$library"
  done
  cargo run --locked --bin uniffi-bindgen generate \
    --library ../../target/release/libcedarling_uniffi.dylib \
    --language swift \
    --out-dir ./build
  make ios-xcframework BUILD_TYPE=release
)

if [[ -n "$(git -C "$JANS_REPO" status --porcelain --untracked-files=no)" ]]; then
  echo "Pinned Jans tracked files changed during the locked build" >&2
  exit 1
fi

UPSTREAM_FRAMEWORK="$BINDING_DIR/ios/Mobile.xcframework"
UPSTREAM_SWIFT="$BINDING_DIR/build/cedarling_uniffi.swift"
if [[ ! -d "$UPSTREAM_FRAMEWORK" || ! -f "$UPSTREAM_SWIFT" ]]; then
  echo "Pinned build did not produce the expected XCFramework and Swift binding" >&2
  exit 1
fi
find "$UPSTREAM_FRAMEWORK" -type f -path '*/Headers/*.swift' -delete
if find "$UPSTREAM_FRAMEWORK" -type f -path '*/Headers/*.swift' -print -quit | grep -q .; then
  echo "XCFramework headers contain an unexpected duplicate Swift binding" >&2
  exit 1
fi
if ! grep -Eq '^(public|open) class Cedarling([ :]|$)' "$UPSTREAM_SWIFT"; then
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

CEDARLING_REVISION="$CURRENT_REVISION" \
CEDARLING_RELEASE_TAG="$PINNED_RELEASE_TAG" \
CEDARLING_GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
CEDARLING_RUST_VERSION="$(rustc --version)" \
CEDARLING_XCODE_VERSION="$(xcodebuild -version | tr '\n' ' ')" \
CEDARLING_MACOS_VERSION="$(sw_vers -productVersion) ($(sw_vers -buildVersion))" \
CEDARLING_PROTOC_VERSION="$(protoc --version)" \
CEDARLING_MINIMUM_IOS_VERSION="$MINIMUM_IOS_VERSION" \
  node "$PROJECT_DIR/scripts/write-ios-provenance.mjs"

"$PROJECT_DIR/scripts/verify-ios-artifacts.sh" --native-only
echo "Synchronized Cedarling iOS artifacts from $CURRENT_REVISION"
