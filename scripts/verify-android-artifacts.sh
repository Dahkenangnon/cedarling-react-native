#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"
PROVENANCE_DIR="$ANDROID_DIR/cedarling-native"
MODE="${1:-}"
ABIS=(armeabi-v7a arm64-v8a x86 x86_64)

if [[ ! -f "$PROVENANCE_DIR/UPSTREAM.json" || ! -f "$PROVENANCE_DIR/SHA256SUMS" ]]; then
  echo "Missing UPSTREAM.json or SHA256SUMS" >&2
  exit 1
fi

(
  cd "$PROVENANCE_DIR"
  sha256sum -c SHA256SUMS
)

for abi in "${ABIS[@]}"; do
  library="$ANDROID_DIR/src/main/jniLibs/$abi/libcedarling_uniffi.so"
  if [[ ! -f "$library" ]]; then
    echo "Missing Cedarling native library for $abi" >&2
    exit 1
  fi

  file "$library"
  size="$(stat -c '%s' "$library")"
  echo "$abi: $size bytes"

  if ! readelf -lW "$library" | grep -q 'GNU_RELRO'; then
    echo "$abi library has no GNU_RELRO segment" >&2
    exit 1
  fi

  while read -r alignment; do
    if (( alignment < 0x4000 )); then
      echo "$abi LOAD alignment $alignment is below 16 KB" >&2
      exit 1
    fi
  done < <(readelf -lW "$library" | awk '$1 == "LOAD" { print $NF }')
done

if [[ "$MODE" == "--native-only" ]]; then
  exit 0
fi

PACK_JSON="$(cd "$PROJECT_DIR" && npm pack --dry-run --json)"
printf '%s\n' "$PACK_JSON" | node -e '
let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  const pack = JSON.parse(data)[0];
  const paths = new Set(pack.files.map((file) => file.path));
  const required = [
    "build/index.js",
    "build/NativeCedarlingReactNative.js",
    "android/src/main/java/expo/modules/cedarling/CedarlingReactNativePackage.kt",
    "android/consumer-rules.pro",
    "android/src/main/java/uniffi/cedarling_uniffi/cedarling_uniffi.kt",
    "android/src/main/jniLibs/armeabi-v7a/libcedarling_uniffi.so",
    "android/src/main/jniLibs/arm64-v8a/libcedarling_uniffi.so",
    "android/src/main/jniLibs/x86/libcedarling_uniffi.so",
    "android/src/main/jniLibs/x86_64/libcedarling_uniffi.so",
    "android/libs/rustls-platform-verifier-0.1.1.jar",
    "android/maven/rustls/rustls-platform-verifier/0.1.1/rustls-platform-verifier-0.1.1.aar",
    "android/maven/rustls/rustls-platform-verifier/0.1.1/rustls-platform-verifier-0.1.1.pom",
    "THIRD_PARTY_NOTICES.md",
  ];
  for (const path of required) {
    if (!paths.has(path)) {
      throw new Error("npm package is missing " + path);
    }
  }
  const forbidden = pack.files
    .map((file) => file.path)
    .filter(
      (path) =>
        path.startsWith("example/") ||
        path.includes("/target/") ||
        path.endsWith(".keystore") ||
        path.endsWith(".jks")
    );
  if (forbidden.length > 0) {
    throw new Error("npm package contains forbidden paths: " + forbidden.join(", "));
  }
  console.log("npm package: " + pack.entryCount + " files, " + pack.size + " bytes packed");
});
'

APK="${CEDARLING_RELEASE_APK:-}"
AAB="${CEDARLING_RELEASE_AAB:-}"
if [[ -z "$APK" ]]; then
  APK="$(find "$PROJECT_DIR/example/android/app/build/outputs/apk/release" -type f -name '*.apk' -print -quit 2>/dev/null || true)"
fi
if [[ -z "$AAB" ]]; then
  AAB="$(find "$PROJECT_DIR/example/android/app/build/outputs/bundle/release" -type f -name '*.aab' -print -quit 2>/dev/null || true)"
fi

if [[ -z "$APK" || ! -f "$APK" ]]; then
  echo "Release APK not found; packaged APK checks were not run" >&2
  exit 1
fi
APK_ENTRIES="$(unzip -Z1 "$APK")"
PACKAGED_LIBRARIES=(libcedarling_uniffi.so libjnidispatch.so)
for abi in "${ABIS[@]}"; do
  for library_name in "${PACKAGED_LIBRARIES[@]}"; do
    if ! grep -Fxq "lib/$abi/$library_name" <<< "$APK_ENTRIES"; then
      echo "Release APK is missing lib/$abi/$library_name" >&2
      exit 1
    fi
  done
done

PACKAGED_ELF_DIR="$(mktemp -d)"
trap 'rm -rf -- "$PACKAGED_ELF_DIR"' EXIT
for abi in "${ABIS[@]}"; do
  for library_name in "${PACKAGED_LIBRARIES[@]}"; do
    packaged_library="$PACKAGED_ELF_DIR/$abi-$library_name"
    unzip -p "$APK" "lib/$abi/$library_name" > "$packaged_library"
    file "$packaged_library"
    if ! readelf -lW "$packaged_library" | grep -q 'GNU_RELRO'; then
      echo "Packaged $abi/$library_name has no GNU_RELRO segment" >&2
      exit 1
    fi
    while read -r alignment; do
      if (( alignment < 0x4000 )); then
        echo "Packaged $abi/$library_name LOAD alignment $alignment is below 16 KB" >&2
        exit 1
      fi
    done < <(readelf -lW "$packaged_library" | awk '$1 == "LOAD" { print $NF }')
  done
done

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
ZIPALIGN=""
if [[ -n "$SDK_ROOT" ]]; then
  ZIPALIGN="$(find "$SDK_ROOT/build-tools" -type f -name zipalign -print 2>/dev/null | sort -V | tail -1)"
fi
if [[ -z "$ZIPALIGN" ]]; then
  echo "zipalign not found" >&2
  exit 1
fi
"$ZIPALIGN" -c -P 16 -v 4 "$APK"

if [[ -z "$AAB" || ! -f "$AAB" ]]; then
  echo "Release AAB not found; bundle checks were not run" >&2
  exit 1
fi
AAB_ENTRIES="$(unzip -Z1 "$AAB")"
for abi in "${ABIS[@]}"; do
  for library_name in "${PACKAGED_LIBRARIES[@]}"; do
    if ! grep -Fxq "base/lib/$abi/$library_name" <<< "$AAB_ENTRIES"; then
      echo "Release AAB is missing base/lib/$abi/$library_name" >&2
      exit 1
    fi
  done
done

if [[ -n "${BUNDLETOOL_JAR:-}" && -f "$BUNDLETOOL_JAR" ]]; then
  BUNDLE_CONFIG="$(java -jar "$BUNDLETOOL_JAR" dump config --bundle "$AAB")"
  printf '%s\n' "$BUNDLE_CONFIG"
  if ! grep -q 'PAGE_ALIGNMENT_16K' <<< "$BUNDLE_CONFIG"; then
    echo "AAB does not declare PAGE_ALIGNMENT_16K" >&2
    exit 1
  fi
else
  echo "BUNDLETOOL_JAR is unavailable; AAB PAGE_ALIGNMENT_16K config was not checked"
fi
