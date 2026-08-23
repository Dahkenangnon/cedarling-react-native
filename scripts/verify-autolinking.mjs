#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expoDir = join(projectDir, 'example');
const bareDir = join(projectDir, 'bare-example');

function commandJson(command, args, cwd) {
  return JSON.parse(
    execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
  );
}

function assertDependency(config, label, platform) {
  const dependency = config.dependencies?.['cedarling-react-native'];
  if (!dependency || resolve(dependency.root) !== projectDir) {
    throw new Error(`${label} did not resolve cedarling-react-native from the package root`);
  }

  const native = dependency.platforms?.[platform];
  if (platform === 'ios') {
    if (
      !native ||
      resolve(native.podspecPath) !== join(projectDir, 'CedarlingReactNative.podspec')
    ) {
      throw new Error(`${label} resolved an unexpected Cedarling iOS podspec`);
    }
    return;
  }

  if (
    !native ||
    resolve(native.sourceDir) !== join(projectDir, 'android') ||
    native.packageImportPath !== 'import expo.modules.cedarling.CedarlingReactNativePackage;' ||
    native.packageInstance !== 'new CedarlingReactNativePackage()' ||
    native.libraryName !== 'CedarlingReactNativeSpec'
  ) {
    throw new Error(`${label} resolved unexpected Cedarling Android TurboModule metadata`);
  }
}

const expoAutolinker = join(
  expoDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'expo-modules-autolinking.cmd' : 'expo-modules-autolinking'
);
for (const platform of ['android', 'ios']) {
  const config = commandJson(
    expoAutolinker,
    ['react-native-config', '--platform', platform, '--json'],
    expoDir
  );
  assertDependency(config, 'Expo SDK 57 React Native autolinking', platform);
}

const bareCli = join(
  bareDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'react-native.cmd' : 'react-native'
);
const bareConfig = commandJson(bareCli, ['config'], bareDir);
for (const platform of ['android', 'ios']) {
  assertDependency(bareConfig, 'React Native Community CLI', platform);
}
if (bareConfig.dependencies?.expo || bareConfig.dependencies?.['expo-modules-core']) {
  throw new Error('Bare React Native autolinking unexpectedly resolved an Expo package');
}

console.log(
  'Expo SDK 57 and bare React Native 0.86.2 resolve the Cedarling TurboModule on Android and iOS'
);
