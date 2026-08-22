#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = join(scriptDir, '..');
const androidDir = join(projectDir, 'android');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error('Missing required environment variable: ' + name);
  }
  return value;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const revision = requiredEnv('CEDARLING_REVISION');
const generatedAt = requiredEnv('CEDARLING_GENERATED_AT');
const rustVersion = requiredEnv('CEDARLING_RUST_VERSION');
const rustFlags = requiredEnv('CEDARLING_RUSTFLAGS');
const ndkVersion = requiredEnv('CEDARLING_NDK_VERSION');
const kotlinPackage = requiredEnv('CEDARLING_KOTLIN_PACKAGE');
const releaseTag = requiredEnv('CEDARLING_RELEASE_TAG');

const provenanceSource = join(
  androidDir,
  'src/main/java/expo/modules/cedarling/CedarlingProvenance.kt'
);
mkdirSync(dirname(provenanceSource), { recursive: true });
writeFileSync(
  provenanceSource,
  [
    'package expo.modules.cedarling',
    '',
    'internal object CedarlingProvenance {',
    '  const val SDK_VERSION = "0.1.0"',
    '  const val CEDARLING_REVISION = "' + revision + '"',
    '  const val CEDARLING_CRATE_VERSION = "2.3.0"',
    '  const val CEDARLING_UNIFFI_CRATE_VERSION = "0.1.0"',
    '  const val UNIFFI_VERSION = "0.29.5"',
    '  val SUPPORTED_ABIS = listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")',
    '}',
    '',
  ].join('\n')
);

const artifactPaths = [
  'src/main/java/expo/modules/cedarling/CedarlingProvenance.kt',
  'src/main/java/org/jans/cedarling/CedarlingAndroid.kt',
  'src/main/java/uniffi/cedarling_uniffi/cedarling_uniffi.kt',
  'src/main/jniLibs/armeabi-v7a/libcedarling_uniffi.so',
  'src/main/jniLibs/arm64-v8a/libcedarling_uniffi.so',
  'src/main/jniLibs/x86/libcedarling_uniffi.so',
  'src/main/jniLibs/x86_64/libcedarling_uniffi.so',
  'libs/rustls-platform-verifier-0.1.1.jar',
  'maven/rustls/rustls-platform-verifier/0.1.1/rustls-platform-verifier-0.1.1.aar',
  'maven/rustls/rustls-platform-verifier/0.1.1/rustls-platform-verifier-0.1.1.pom',
];

const artifacts = artifactPaths.map((artifactPath) => {
  const absolutePath = join(androidDir, artifactPath);
  return {
    path: artifactPath,
    sha256: sha256(absolutePath),
    sizeBytes: statSync(absolutePath).size,
  };
});

const provenance = {
  schemaVersion: 1,
  repository: 'https://github.com/JanssenProject/jans.git',
  releaseTag,
  revision,
  cedarlingCrateVersion: '2.3.0',
  cedarlingUniffiCrateVersion: '0.1.0',
  uniffiVersion: '0.29.5',
  uniffiKotlinAndroid: true,
  buildType: 'release',
  rustVersion,
  rustFlags,
  androidNdkVersion: ndkVersion,
  elfLoadAlignmentBytes: 16384,
  generatedBindingPackage: kotlinPackage,
  supportedAbis: ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
  generatedAt,
  artifacts,
};

const provenanceDir = join(androidDir, 'cedarling-native');
mkdirSync(provenanceDir, { recursive: true });
writeFileSync(join(provenanceDir, 'UPSTREAM.json'), JSON.stringify(provenance, null, 2) + '\n');
writeFileSync(
  join(provenanceDir, 'SHA256SUMS'),
  artifacts
    .map((artifact) => artifact.sha256 + '  ' + relative(provenanceDir, join(androidDir, artifact.path)))
    .join('\n') + '\n'
);
