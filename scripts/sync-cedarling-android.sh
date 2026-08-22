#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
UNIFFI_CONFIG="$SCRIPT_DIR/uniffi-android.toml"
PIN_FILE="$PROJECT_DIR/android/cedarling-native/PINNED_REVISION"
UPDATE_MODE=false
JANS_REPO=""

usage() {
  echo "Usage: scripts/sync-cedarling-android.sh [--update] [JANS_REPO]" >&2
}

while (( $# > 0 )); do
  case "$1" in
    --update)
      UPDATE_MODE=true
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

if [[ -z "$JANS_REPO" ]]; then
  JANS_REPO="${CEDARLING_JANS_REPO:-}"
fi
if [[ -z "$JANS_REPO" ]]; then
  echo "Supply a Jans checkout argument or CEDARLING_JANS_REPO" >&2
  exit 2
fi

JANS_REPO="$(cd -- "$JANS_REPO" && pwd)"
if ! git -C "$JANS_REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a Jans Git checkout: $JANS_REPO" >&2
  exit 1
fi
if [[ ! -d "$JANS_REPO/jans-cedarling/bindings/cedarling_uniffi" ]]; then
  echo "Missing jans-cedarling/bindings/cedarling_uniffi in $JANS_REPO" >&2
  exit 1
fi

CURRENT_REVISION="$(git -C "$JANS_REPO" rev-parse HEAD)"
PINNED_REVISION="$(tr -d '[:space:]' < "$PIN_FILE")"
echo "Jans revision: $CURRENT_REVISION"

if [[ "$UPDATE_MODE" == true ]]; then
  printf '%s\n' "$CURRENT_REVISION" > "$PIN_FILE"
  PINNED_REVISION="$CURRENT_REVISION"
elif [[ "$CURRENT_REVISION" != "$PINNED_REVISION" ]]; then
  echo "Jans checkout revision does not match $PINNED_REVISION" >&2
  echo "Check out the pinned revision or pass --update to replace the pin" >&2
  exit 1
fi

BINDING_DIR="$JANS_REPO/jans-cedarling/bindings/cedarling_uniffi"
LIB_RS="$BINDING_DIR/src/lib.rs"
ANDROID_RS="$BINDING_DIR/src/android.rs"
for symbol in load_from_json load_from_json_with_archive_bytes authorize_unsigned authorize_multi_issuer; do
  if ! grep -q "pub fn $symbol" "$LIB_RS"; then
    echo "Pinned source is missing required API: $symbol" >&2
    exit 1
  fi
done
if ! grep -q "Java_org_jans_cedarling_CedarlingAndroid_initTls" "$ANDROID_RS"; then
  echo "Pinned source is missing the required Android TLS JNI export" >&2
  exit 1
fi

NDK_HOME="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
if [[ -z "$NDK_HOME" || ! -f "$NDK_HOME/source.properties" ]]; then
  echo "ANDROID_NDK_HOME must point to Android NDK r28 or newer" >&2
  exit 1
fi
NDK_VERSION="$(awk -F'= ' '/Pkg.Revision/ { print $2 }' "$NDK_HOME/source.properties")"
NDK_MAJOR="${NDK_VERSION%%.*}"
if (( NDK_MAJOR < 28 )); then
  echo "Android NDK $NDK_VERSION is too old; r28 or newer is required" >&2
  exit 1
fi

# Android 15 devices may use 16 KB memory pages. Keep this explicit even with
# NDK releases that support flexible page sizes so every synchronized binary
# has a verifiable ELF LOAD alignment.
CEDARLING_ANDROID_RUSTFLAGS="${RUSTFLAGS:+$RUSTFLAGS }-C link-arg=-Wl,-z,max-page-size=16384"

if ! command -v cargo-ndk >/dev/null 2>&1; then
  echo "cargo-ndk is required for maintainer synchronization" >&2
  exit 1
fi

(
  cd "$BINDING_DIR"
  export ANDROID_NDK_HOME="$NDK_HOME"
  export RUSTFLAGS="$CEDARLING_ANDROID_RUSTFLAGS"
  make build BUILD_TYPE=release
  make android-build BUILD_TYPE=release
  cargo run --release --bin uniffi-bindgen generate \
    --library ../../target/release/libcedarling_uniffi.so \
    --language kotlin \
    --config "$UNIFFI_CONFIG" \
    --no-format \
    --out-dir ./androidApp/app/src/main/java/com/example/androidapp/cedarling/uniffi
)

GENERATED_KOTLIN="$(find "$BINDING_DIR/androidApp/app/src/main/java" -type f -name cedarling_uniffi.kt -print -quit)"
ANDROID_HELPER="$BINDING_DIR/androidApp/app/src/main/java/org/jans/cedarling/CedarlingAndroid.kt"
if [[ -z "$GENERATED_KOTLIN" || ! -f "$GENERATED_KOTLIN" ]]; then
  echo "Unable to locate the generated Kotlin binding" >&2
  exit 1
fi
KOTLIN_PACKAGE="$(sed -n 's/^package[[:space:]][[:space:]]*//p' "$GENERATED_KOTLIN" | head -1)"
if [[ "$KOTLIN_PACKAGE" != "uniffi.cedarling_uniffi" ]]; then
  echo "Unexpected generated Kotlin package: $KOTLIN_PACKAGE" >&2
  exit 1
fi

install -Dm644 "$GENERATED_KOTLIN" \
  "$PROJECT_DIR/android/src/main/java/uniffi/cedarling_uniffi/cedarling_uniffi.kt"
install -Dm644 "$ANDROID_HELPER" \
  "$PROJECT_DIR/android/src/main/java/org/jans/cedarling/CedarlingAndroid.kt"

for abi in armeabi-v7a arm64-v8a x86 x86_64; do
  source_library="$BINDING_DIR/androidApp/app/src/main/jniLibs/$abi/libcedarling_uniffi.so"
  if [[ ! -f "$source_library" ]]; then
    echo "Missing generated native library for $abi" >&2
    exit 1
  fi
  install -Dm644 "$source_library" \
    "$PROJECT_DIR/android/src/main/jniLibs/$abi/libcedarling_uniffi.so"
done

RUSTLS_MANIFEST="$(
  cargo metadata \
    --format-version 1 \
    --filter-platform aarch64-linux-android \
    --manifest-path "$BINDING_DIR/Cargo.toml" |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s).packages.find(p=>p.name==='rustls-platform-verifier-android');if(!p)process.exit(1);process.stdout.write(p.manifest_path)})"
)"
RUSTLS_AAR="$(find "$(dirname -- "$RUSTLS_MANIFEST")/maven" -type f -name 'rustls-platform-verifier-0.1.1.aar' -print -quit)"
RUSTLS_POM="$(find "$(dirname -- "$RUSTLS_MANIFEST")/maven" -type f -name 'rustls-platform-verifier-0.1.1.pom' -print -quit)"
if [[ -z "$RUSTLS_AAR" || -z "$RUSTLS_POM" ]]; then
  echo "Unable to locate rustls-platform-verifier 0.1.1 Maven artifacts" >&2
  exit 1
fi
install -Dm644 "$RUSTLS_AAR" \
  "$PROJECT_DIR/android/maven/rustls/rustls-platform-verifier/0.1.1/rustls-platform-verifier-0.1.1.aar"
install -Dm644 "$RUSTLS_POM" \
  "$PROJECT_DIR/android/maven/rustls/rustls-platform-verifier/0.1.1/rustls-platform-verifier-0.1.1.pom"
RUSTLS_JAR="$PROJECT_DIR/android/libs/rustls-platform-verifier-0.1.1.jar"
install -d -m755 "$(dirname -- "$RUSTLS_JAR")"
unzip -p "$RUSTLS_AAR" classes.jar > "$RUSTLS_JAR"
RUSTLS_JAR_ENTRIES="$(unzip -Z1 "$RUSTLS_JAR")"
if ! grep -Fxq 'org/rustls/platformverifier/CertificateVerifier.class' <<< "$RUSTLS_JAR_ENTRIES"; then
  echo "Extracted rustls verifier JAR is missing CertificateVerifier" >&2
  exit 1
fi

RELEASE_TAG="$(git -C "$JANS_REPO" describe --tags --exact-match 2>/dev/null || printf 'unreleased')"
CEDARLING_REVISION="$CURRENT_REVISION" \
CEDARLING_RELEASE_TAG="$RELEASE_TAG" \
CEDARLING_GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
CEDARLING_RUST_VERSION="$(cd "$JANS_REPO/jans-cedarling" && rustc --version)" \
CEDARLING_RUSTFLAGS="$CEDARLING_ANDROID_RUSTFLAGS" \
CEDARLING_NDK_VERSION="$NDK_VERSION" \
CEDARLING_KOTLIN_PACKAGE="$KOTLIN_PACKAGE" \
  node "$PROJECT_DIR/scripts/write-provenance.mjs"

"$PROJECT_DIR/scripts/verify-android-artifacts.sh" --native-only
echo "Synchronized Cedarling Android artifacts from $CURRENT_REVISION"
