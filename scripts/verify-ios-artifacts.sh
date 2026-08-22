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
if (provenance.releaseTag !== 'v2.3.0') {
  throw new Error('Unexpected Cedarling iOS release tag');
}
if (provenance.minimumIosVersion !== '17.5') {
  throw new Error('Unexpected minimum iOS version');
}
if (provenance.cargoLocked !== true) {
  throw new Error('iOS artifacts were not generated with Cargo.lock enforcement');
}
if (provenance.gitBlobLimitBytes !== 104857600) {
  throw new Error('Unexpected iOS Git blob size limit');
}
for (const target of provenance.rustTargets ?? []) requiredTargets.delete(target);
for (const architecture of provenance.supportedArchitectures ?? []) {
  requiredArchitectures.delete(architecture);
}
if (requiredTargets.size || requiredArchitectures.size) {
  throw new Error('iOS provenance is missing a required target or architecture');
}
NODE

if ! grep -Eq '^(public|open) class Cedarling([ :]|$)' \
  "$IOS_DIR/generated/cedarling_uniffi.swift"; then
  echo "Generated Swift binding is missing Cedarling" >&2
  exit 1
fi
MODULE_MAPS=()
while IFS= read -r module_map; do
  MODULE_MAPS+=("$module_map")
done < <(find "$FRAMEWORK" -type f -name module.modulemap -print | sort)
HEADERS=()
while IFS= read -r header; do
  HEADERS+=("$header")
done < <(find "$FRAMEWORK" -type f -name 'cedarling_uniffiFFI.h' -print | sort)
if (( ${#MODULE_MAPS[@]} != 2 || ${#HEADERS[@]} != 2 )); then
  echo "Expected a module map and public UniFFI header in both XCFramework slices" >&2
  exit 1
fi
for module_map in "${MODULE_MAPS[@]}"; do
  if ! grep -q 'module cedarling_uniffiFFI' "$module_map"; then
    echo "XCFramework module map has an unexpected module name: $module_map" >&2
    exit 1
  fi
done
for header in "${HEADERS[@]}"; do
  if [[ ! -s "$header" ]] || ! grep -q 'cedarling_uniffi' "$header"; then
    echo "XCFramework has an invalid public UniFFI header: $header" >&2
    exit 1
  fi
done

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
    library_size="$(wc -c < "$library" | tr -d '[:space:]')"
    if (( library_size >= 104857600 )); then
      echo "Static library reaches GitHub's 100 MiB blob limit: $library ($library_size bytes)" >&2
      exit 1
    fi

    if ! lipo -info "$library" | grep -q 'arm64'; then
      echo "Static library is missing arm64: $library" >&2
      exit 1
    fi
    if ! file "$library" | grep -q 'current ar archive'; then
      echo "Expected a static archive: $library" >&2
      exit 1
    fi
    if ! otool -l "$library" | awk '
      $1 == "cmd" && ($2 == "LC_BUILD_VERSION" || $2 == "LC_VERSION_MIN_IPHONEOS") {
        version_command = 1
        next
      }
      version_command && (($1 == "minos" || $1 == "version") && $2 == "17.5") {
        found = 1
      }
      END { exit found ? 0 : 1 }
    '; then
      echo "Static library does not record the iOS 17.5 deployment target: $library" >&2
      exit 1
    fi
    if otool -L "$library" | grep -E '^[[:space:]]+(/Users/|/home/)' >/dev/null; then
      echo "Static library contains a machine-local dynamic dependency: $library" >&2
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

if grep -R -n -E \
  --include='*.swift' --include='*.h' --include='*.modulemap' --include='*.json' \
  '/Users/|/home/|file:///|https?://[^[:space:]]+/(latest|main)(/|$)' "$IOS_DIR"; then
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
  const forbidden = pack.files
    .map((file) => file.path)
    .filter((path) => path.startsWith("ios/Tests/") || path.startsWith("example/"));
  if (forbidden.length > 0) {
    throw new Error("npm package contains development-only paths: " + forbidden.join(", "));
  }
  console.log(`npm iOS payload: ${pack.entryCount} files, ${pack.size} bytes packed`);
});
'
