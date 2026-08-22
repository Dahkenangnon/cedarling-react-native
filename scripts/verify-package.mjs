#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: projectDir,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
const [pack] = JSON.parse(output);
if (!pack || !Array.isArray(pack.files)) {
  throw new Error('npm pack returned an unexpected result');
}

const paths = pack.files.map((file) => file.path);
const pathSet = new Set(paths);
const required = [
  'build/index.js',
  'build/index.d.ts',
  'expo-module.config.json',
  'CedarlingReactNative.podspec',
  'THIRD_PARTY_NOTICES.md',
  'android/consumer-rules.pro',
  'android/src/main/java/uniffi/cedarling_uniffi/cedarling_uniffi.kt',
  'android/src/main/jniLibs/armeabi-v7a/libcedarling_uniffi.so',
  'android/src/main/jniLibs/arm64-v8a/libcedarling_uniffi.so',
  'android/src/main/jniLibs/x86/libcedarling_uniffi.so',
  'android/src/main/jniLibs/x86_64/libcedarling_uniffi.so',
  'android/libs/rustls-platform-verifier-0.1.1.jar',
  'android/maven/rustls/rustls-platform-verifier/0.1.1/rustls-platform-verifier-0.1.1.aar',
  'android/maven/rustls/rustls-platform-verifier/0.1.1/rustls-platform-verifier-0.1.1.pom',
  'ios/CedarlingArchive.swift',
  'ios/CedarlingError.swift',
  'ios/CedarlingJson.swift',
  'ios/CedarlingProvenance.swift',
  'ios/CedarlingReactNativeModule.swift',
  'ios/CedarlingResultMapper.swift',
  'ios/CedarlingService.swift',
  'ios/generated/cedarling_uniffi.swift',
  'ios/CedarlingNative.xcframework/Info.plist',
  'ios/cedarling-native/PINNED_REVISION',
  'ios/cedarling-native/SHA256SUMS',
  'ios/cedarling-native/UPSTREAM.json',
];
for (const path of required) {
  if (!pathSet.has(path)) {
    throw new Error(`npm package is missing ${path}`);
  }
}

const countSuffix = (suffix) => paths.filter((path) => path.endsWith(suffix)).length;
if (countSuffix('/libcedarling_uniffi.a') !== 2) {
  throw new Error('npm package must contain exactly two Cedarling iOS static libraries');
}
if (countSuffix('/cedarling_uniffiFFI.h') !== 2 || countSuffix('/module.modulemap') !== 2) {
  throw new Error('npm package must contain public headers and module maps for both iOS slices');
}

const forbidden = paths.filter(
  (path) =>
    path.startsWith('example/') ||
    path.startsWith('ios/Tests/') ||
    path.includes('/target/') ||
    path.endsWith('.keystore') ||
    path.endsWith('.jks') ||
    path.endsWith('.mobileprovision') ||
    path.endsWith('.p12') ||
    /(^|\/)\.env($|\.)/.test(path)
);
if (forbidden.length > 0) {
  throw new Error(`npm package contains development-only or secret paths: ${forbidden.join(', ')}`);
}

console.log(
  `npm package: ${pack.entryCount} files, ${pack.size} bytes packed, ${pack.unpackedSize} bytes unpacked`
);
