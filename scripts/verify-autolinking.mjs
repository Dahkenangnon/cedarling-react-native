#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exampleDir = join(projectDir, 'example');
const autolinker = join(
  projectDir,
  'node_modules',
  'expo-modules-autolinking',
  'bin',
  'expo-modules-autolinking.js'
);

function resolvePlatform(platform) {
  const output = execFileSync(
    process.execPath,
    [autolinker, 'resolve', '--platform', platform, '--json'],
    { cwd: exampleDir, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  );
  const result = JSON.parse(output);
  const module = result.modules?.find(
    (candidate) => candidate.packageName === 'cedarling-react-native'
  );
  if (!module) {
    throw new Error(`Expo did not resolve cedarling-react-native for ${platform}`);
  }
  return module;
}

const ios = resolvePlatform('ios');
if (
  !ios.pods?.some(
    (pod) => pod.podName === 'CedarlingReactNative' && resolve(pod.podspecDir) === projectDir
  ) ||
  !ios.modules?.some((module) => module.class === 'CedarlingReactNativeModule')
) {
  throw new Error('Expo resolved an unexpected Cedarling iOS pod or module class');
}

const android = resolvePlatform('android');
if (
  !android.projects?.some(
    (nativeProject) =>
      resolve(nativeProject.sourceDir) === join(projectDir, 'android') &&
      nativeProject.modules?.some(
        (module) => module.classifier === 'expo.modules.cedarling.CedarlingReactNativeModule'
      )
  )
) {
  throw new Error('Expo resolved an unexpected Cedarling Android project or module class');
}

console.log('Expo autolinking resolved Cedarling for iOS and Android');
