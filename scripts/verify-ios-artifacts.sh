#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$PROJECT_DIR/ios"
PROVENANCE_DIR="$IOS_DIR/cedarling-native"
FRAMEWORK="$IOS_DIR/CedarlingNative.xcframework"
MODE="${1:-}"

"$SCRIPT_DIR/verify-native-pin.sh"

for path in \
  "$PROVENANCE_DIR/UPSTREAM.json" \
  "$PROVENANCE_DIR/SHA256SUMS" \
  "$FRAMEWORK/Info.plist" \
  "$IOS_DIR/generated/cedarling_uniffi.swift" \
  "$IOS_DIR/CedarlingProvenance.swift"; do
  if [[ ! -e "$path" ]]; then
    echo "Missing required iOS artifact: $path" >&2
    exit 1
  fi
done

(
  cd "$PROVENANCE_DIR"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c SHA256SUMS
  else
    shasum -a 256 -c SHA256SUMS
  fi
)

node - "$PROVENANCE_DIR/UPSTREAM.json" <<'NODE'
const fs = require('node:fs');
const provenance = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const requiredTargets = new Set(['aarch64-apple-ios', 'aarch64-apple-ios-sim']);
const requiredArchitectures = new Set(['ios-arm64', 'ios-simulator-arm64']);
if (provenance.revision !== 'f7c6e34be6ac8d585a9d7b6f7a12921b440b495b') {
  throw new Error('Unexpected Cedarling iOS revision');
}
if (provenance.minimumIosVersion !== '16.4') {
  throw new Error('Unexpected minimum iOS version');
}
for (const target of provenance.rustTargets ?? []) requiredTargets.delete(target);
for (const architecture of provenance.supportedArchitectures ?? []) {
  requiredArchitectures.delete(architecture);
}
if (requiredTargets.size || requiredArchitectures.size) {
  throw new Error('iOS provenance is missing a required target or architecture');
}
NODE

if ! grep -q 'public class Cedarling' "$IOS_DIR/generated/cedarling_uniffi.swift"; then
  echo "Generated Swift binding is missing Cedarling" >&2
  exit 1
fi
if ! grep -q 'module cedarling_uniffiFFI' \
  "$(find "$FRAMEWORK" -type f -name module.modulemap -print -quit)"; then
  echo "XCFramework module map has an unexpected module name" >&2
  exit 1
fi

LIBRARIES=()
while IFS= read -r library; do
  LIBRARIES+=("$library")
done < <(find "$FRAMEWORK" -type f -name 'libcedarling_uniffi.a' -print | sort)
if (( ${#LIBRARIES[@]} != 2 )); then
  echo "Expected two Cedarling static libraries, found ${#LIBRARIES[@]}" >&2
  exit 1
fi
if find "$FRAMEWORK" -type f -name '*.dylib' -print -quit | grep -q .; then
  echo "XCFramework unexpectedly contains a dynamic library" >&2
  exit 1
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  for library in "${LIBRARIES[@]}"; do
    if ! lipo -info "$library" | grep -q 'arm64'; then
      echo "Static library is missing arm64: $library" >&2
      exit 1
    fi
    if ! file "$library" | grep -q 'current ar archive'; then
      echo "Expected a static archive: $library" >&2
      exit 1
    fi
  done

  PLIST_JSON="$(plutil -convert json -o - "$FRAMEWORK/Info.plist")"
  printf '%s\n' "$PLIST_JSON" | node -e '
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const plist = JSON.parse(input);
  const libraries = plist.AvailableLibraries ?? [];
  if (libraries.length !== 2) throw new Error("Expected two XCFramework slices");
  const platforms = new Set(libraries.map((entry) =>
    entry.SupportedPlatformVariant === "simulator" ? "ios-simulator" : entry.SupportedPlatform
  ));
  if (!platforms.has("ios") || !platforms.has("ios-simulator")) {
    throw new Error("XCFramework is missing device or simulator support");
  }
  for (const entry of libraries) {
    if (!(entry.SupportedArchitectures ?? []).includes("arm64")) {
      throw new Error("XCFramework slice is missing arm64");
    }
  }
});
'
else
  if ! grep -q '<string>ios</string>' "$FRAMEWORK/Info.plist" ||
     ! grep -q '<string>simulator</string>' "$FRAMEWORK/Info.plist"; then
    echo "XCFramework Info.plist is missing device or simulator metadata" >&2
    exit 1
  fi
fi

if rg -n '/Users/|/home/|file:///|https?://[^ ]+/(latest|main)(/|$)' "$IOS_DIR" \
  --glob '*.swift' --glob '*.h' --glob '*.modulemap' --glob '*.json'; then
  echo "iOS artifacts contain a machine-local path or mutable download URL" >&2
  exit 1
fi

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
    "CedarlingReactNative.podspec",
    "ios/CedarlingProvenance.swift",
    "ios/generated/cedarling_uniffi.swift",
    "ios/CedarlingNative.xcframework/Info.plist",
    "ios/cedarling-native/PINNED_REVISION",
    "ios/cedarling-native/SHA256SUMS",
    "ios/cedarling-native/UPSTREAM.json",
  ];
  for (const path of required) {
    if (!paths.has(path)) throw new Error("npm package is missing " + path);
  }
  if (!pack.files.some((file) => file.path.endsWith("libcedarling_uniffi.a"))) {
    throw new Error("npm package is missing Cedarling iOS static libraries");
  }
  console.log(`npm iOS payload: ${pack.entryCount} files, ${pack.size} bytes packed`);
});
'
