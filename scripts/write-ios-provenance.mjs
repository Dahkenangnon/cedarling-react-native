#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = join(scriptDir, '..');
const iosDir = join(projectDir, 'ios');
const provenanceDir = join(iosDir, 'cedarling-native');

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function listFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') {
      continue;
    }
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(path));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push(path);
    }
  }
  return files;
}

const revision = requiredEnv('CEDARLING_REVISION');
const releaseTag = requiredEnv('CEDARLING_RELEASE_TAG');
const generatedAt = requiredEnv('CEDARLING_GENERATED_AT');
const rustVersion = requiredEnv('CEDARLING_RUST_VERSION');
const xcodeVersion = requiredEnv('CEDARLING_XCODE_VERSION');
const macosVersion = requiredEnv('CEDARLING_MACOS_VERSION');
const protocVersion = requiredEnv('CEDARLING_PROTOC_VERSION');
const minimumIosVersion = requiredEnv('CEDARLING_MINIMUM_IOS_VERSION');

const provenanceSource = join(iosDir, 'CedarlingProvenance.swift');
writeFileSync(
  provenanceSource,
  [
    'internal enum CedarlingProvenance {',
    '  static let sdkVersion = "0.1.0"',
    `  static let cedarlingRevision = "${revision}"`,
    '  static let cedarlingCrateVersion = "2.3.0"',
    '  static let cedarlingUniffiCrateVersion = "0.1.0"',
    '  static let uniffiVersion = "0.29.5"',
    '  static let supportedArchitectures = ["ios-arm64", "ios-simulator-arm64"]',
    '}',
    '',
  ].join('\n')
);

const artifactFiles = [
  join(iosDir, 'generated', 'cedarling_uniffi.swift'),
  provenanceSource,
  ...listFiles(join(iosDir, 'CedarlingNative.xcframework')),
].sort((left, right) => left.localeCompare(right));

for (const path of artifactFiles) {
  if (!lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink()) {
    throw new Error(`Unexpected non-file artifact: ${path}`);
  }
}

const artifacts = artifactFiles.map((absolutePath) => ({
  path: relative(iosDir, absolutePath),
  sha256: sha256(absolutePath),
  sizeBytes: statSync(absolutePath).size,
}));

const provenance = {
  schemaVersion: 1,
  repository: 'https://github.com/JanssenProject/jans.git',
  releaseTag,
  revision,
  cedarlingCrateVersion: '2.3.0',
  cedarlingUniffiCrateVersion: '0.1.0',
  uniffiVersion: '0.29.5',
  uniffiLanguage: 'swift',
  buildType: 'release',
  cargoLocked: true,
  gitBlobLimitBytes: 104857600,
  rustVersion,
  xcodeVersion,
  macosVersion,
  protocVersion,
  minimumIosVersion,
  rustTargets: ['aarch64-apple-ios', 'aarch64-apple-ios-sim'],
  supportedArchitectures: ['ios-arm64', 'ios-simulator-arm64'],
  generatedBindingModule: 'cedarling_uniffiFFI',
  buildCommands: [
    "make build BUILD_TYPE=release CARGO_FLAGS='--release --locked'",
    'IPHONEOS_DEPLOYMENT_TARGET=17.5 cargo build --release --locked -p cedarling_uniffi --target=aarch64-apple-ios-sim',
    'IPHONEOS_DEPLOYMENT_TARGET=17.5 cargo build --release --locked -p cedarling_uniffi --target=aarch64-apple-ios',
    'xcrun strip -S ../../target/aarch64-apple-ios-sim/release/libcedarling_uniffi.a && xcrun ranlib ../../target/aarch64-apple-ios-sim/release/libcedarling_uniffi.a',
    'xcrun strip -S ../../target/aarch64-apple-ios/release/libcedarling_uniffi.a && xcrun ranlib ../../target/aarch64-apple-ios/release/libcedarling_uniffi.a',
    'cargo run --locked --bin uniffi-bindgen generate --library ../../target/release/libcedarling_uniffi.dylib --language swift --out-dir ./build',
    'make ios-xcframework BUILD_TYPE=release',
    "find ios/Mobile.xcframework -type f -path '*/Headers/*.swift' -delete",
  ],
  generatedAt,
  artifacts,
};

mkdirSync(provenanceDir, { recursive: true });
writeFileSync(join(provenanceDir, 'UPSTREAM.json'), `${JSON.stringify(provenance, null, 2)}\n`);
writeFileSync(
  join(provenanceDir, 'SHA256SUMS'),
  `${artifacts.map((artifact) => `${artifact.sha256}  ../${artifact.path}`).join('\n')}\n`
);
