#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$PROJECT_DIR/example/assets/policy-store"
OUTPUT_FILE="$PROJECT_DIR/example/assets/policy-store.cjar"
ANDROID_TEST_ASSETS="$PROJECT_DIR/android/src/androidTest/assets"
TEMP_DIR="$(mktemp -d /tmp/cedarling-policy-store.XXXXXX)"

cleanup() {
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT

for required_file in metadata.json schema.cedarschema policies/allow_reader.cedar; do
  if [[ ! -f "$SOURCE_DIR/$required_file" ]]; then
    echo "Missing policy-store source file: $required_file" >&2
    exit 1
  fi
done

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required to build policy-store.cjar" >&2
  exit 1
fi

mkdir -p "$TEMP_DIR/policy-store" "$ANDROID_TEST_ASSETS"
cp -R "$SOURCE_DIR/." "$TEMP_DIR/policy-store/"
find "$TEMP_DIR/policy-store" -type f -exec touch -t 202608220000.00 {} +

(
  cd "$TEMP_DIR/policy-store"
  find . -type f -print0 |
    LC_ALL=C sort -z |
    xargs -0 zip -X -q "$OUTPUT_FILE"
)

cp "$OUTPUT_FILE" "$ANDROID_TEST_ASSETS/policy-store.cjar"
cp "$PROJECT_DIR/example/assets/fixtures/bootstrap.json" \
  "$ANDROID_TEST_ASSETS/bootstrap.json"

echo "Built $OUTPUT_FILE"
