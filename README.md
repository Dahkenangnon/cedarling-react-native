# cedarling-react-native

Experimental Android-first Expo module for running Jans Cedarling inside a React Native application.

> Authorization performed in a mobile client can control local user experience and provide defense in depth, but the client is not a trusted enforcement boundary. Backend services must independently authenticate the request and re-evaluate authorization for protected operations.

## Architecture

The package follows one native path:

```text
React Native TypeScript
  -> Expo Modules API
  -> synchronized Kotlin service
  -> generated Kotlin UniFFI binding
  -> libcedarling_uniffi.so
  -> Cedarling Rust core
```

Native UniFFI is used because Cedarling already publishes this binding and the Expo Modules API supplies the supported React Native bridge. There is no WASM runtime, WebView, remote authorization sidecar, custom C++ bridge, or policy evaluator duplicated in TypeScript/Kotlin.

The npm package contains the generated Kotlin binding, its Android TLS helper, the pinned rustls verifier JVM classes, and release shared libraries for all supported ABIs. Application developers do not need Rust, Cargo, the Android NDK, or a Jans source checkout.

## Support

Version 0.1.0 supports Android only:

- Expo SDK 57 development and release builds
- React Native 0.86.2 with Hermes and the New Architecture
- Android API 24 or newer
- `armeabi-v7a`, `arm64-v8a`, `x86`, and `x86_64`

The verified build stack is Expo 57.0.15, Expo Modules Core 57.0.12, React Native 0.86.2, React 19.2.3, Android Gradle Plugin 8.12.0, Gradle 9.3.1, compile/target API 36, host-app NDK 27.1.12297006, JNA 5.19.1, and rustls-platform-verifier Android 0.1.1. The prebuilt Cedarling libraries use NDK 29.0.14206865 and Rust 1.95.0.

Importing on iOS or web is safe, but all operations reject with `E_UNSUPPORTED_PLATFORM`. The package does not claim iOS support and does not run in Expo Go because it contains native code.

## Install

```sh
npm install cedarling-react-native expo-asset
```

Create a native development build after installing or changing the module:

```sh
npx expo prebuild --platform android
npx expo run:android
```

For this repository:

```sh
npm install
cd example
npm install
npx expo prebuild --clean --platform android
npx expo run:android
```

The package is auto-linked as the Expo module `CedarlingReactNative`; no `MainApplication` edit is required.

## Initialize from an Expo asset

Add `cjar` to Metro's asset extensions:

```js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('cjar');
module.exports = config;
```

Then resolve the archive to a local URI. The URI crosses the native boundary as a string and Kotlin reads its bytes directly; the archive is never Base64 encoded.

```ts
import { Asset } from 'expo-asset';
import { Cedarling } from 'cedarling-react-native';

const archive = Asset.fromModule(require('./assets/policy-store.cjar'));
await archive.downloadAsync();

if (!archive.localUri) {
  throw new Error('Policy-store asset has no local URI');
}

await Cedarling.initialize({
  bootstrap: {
    CEDARLING_APPLICATION_NAME: 'My mobile app',
    CEDARLING_LOG_LEVEL: 'ERROR',
    CEDARLING_LOG_TYPE: 'memory',
  },
  policyStore: {
    kind: 'archive',
    uri: archive.localUri,
  },
});
```

Supported local archive forms are `file://`, `content://`, and validated absolute paths. `http://` and `https://` are rejected at this boundary. Configure supported remote stores in Cedarling bootstrap JSON instead.

Archive reads are capped at 10 MiB and enforced while streaming; `InputStream.available()` is not used as a size guarantee. Expo Asset cache files need exist only for initialization because Cedarling consumes the bytes immediately.

## Bootstrap-only initialization

Without `policyStore`, bootstrap JSON is passed to `Cedarling.loadFromJson` and may use any inline, local-file, or remote policy-store configuration supported by the pinned Cedarling release:

```ts
await Cedarling.initialize({
  bootstrap: JSON.stringify({
    CEDARLING_APPLICATION_NAME: 'My mobile app',
    CEDARLING_POLICY_STORE_LOCAL_FN: '/data/user/0/example/files/policy.json',
  }),
});
```

Bootstrap objects are serialized once in TypeScript. Bootstrap strings must contain a JSON object.

## Unsigned authorization

```ts
const result = await Cedarling.authorizeUnsigned({
  principal: {
    cedar_entity_mapping: {
      entity_type: 'MyApp::User',
      id: 'alice',
    },
    role: 'reader',
  },
  action: 'MyApp::Action::"Read"',
  resource: {
    cedar_entity_mapping: {
      entity_type: 'MyApp::Document',
      id: 'document-1',
    },
  },
  context: {},
});

console.log(result.allowed, result.decision);
console.log(result.requestId, result.diagnostics);
```

The Boolean and Cedar enum decision are checked for agreement. A disagreement rejects with `E_NATIVE_RESULT_INCONSISTENT`; it can never become ALLOW.

## Multi-issuer authorization

```ts
const result = await Cedarling.authorizeMultiIssuer({
  tokens: [
    {
      mapping: 'Jans::Access_Token',
      payload: accessToken,
    },
  ],
  action: 'MyApp::Action::"Read"',
  resource,
  context: {},
});
```

Token lists, mappings, and payloads must be nonempty. Token contents are not logged by the SDK.

## Errors

All operations reject with `CedarlingError`, which has a stable `code`:

- `E_UNSUPPORTED_PLATFORM`
- `E_NOT_INITIALIZED`
- `E_ALREADY_DISPOSED`
- `E_INVALID_INPUT`
- `E_INVALID_JSON`
- `E_ARCHIVE_IO`
- `E_ARCHIVE_TOO_LARGE`
- `E_INITIALIZATION`
- `E_AUTHORIZATION`
- `E_NATIVE_RESULT_INCONSISTENT`
- `E_NATIVE`

```ts
import { Cedarling, CedarlingError } from 'cedarling-react-native';

try {
  await Cedarling.authorizeUnsigned(request);
} catch (error) {
  if (error instanceof CedarlingError) {
    // Handle error.code without treating failure as an authorization result.
  }
}
```

Errors reject promises and never fall back to ALLOW. The module does not automatically log tokens, bootstrap values, entities, policies, or diagnostics.

## Threading and lifecycle

Initialization and authorization are Expo `AsyncFunction` coroutine bodies and run on `Dispatchers.IO`. A coroutine `Mutex` serializes initialization, authorization, replacement, and disposal around one retained blocking Cedarling instance.

TLS initialization is lazy, idempotent, and receives only `context.applicationContext`. Reinitialization constructs a complete replacement before swapping it in; failure leaves the previous valid instance active. `dispose()` calls the generated `shutDown()` and `destroy()` lifetime methods. A subsequent `initialize()` is supported. Expo module destruction schedules the same release on an IO dispatcher.

## Native artifacts and size

The package supports:

| ABI | Library | Source bytes |
| --- | --- | ---: |
| armeabi-v7a | `libcedarling_uniffi.so` | 19,145,520 |
| arm64-v8a | `libcedarling_uniffi.so` | 28,395,176 |
| x86 | `libcedarling_uniffi.so` | 28,422,072 |
| x86_64 | `libcedarling_uniffi.so` | 28,979,384 |

Exact byte sizes and SHA-256 values are recorded in `android/cedarling-native/UPSTREAM.json` after synchronization. The full npm tarball and per-ABI sizes are reported by `npm run verify:android-artifacts`.

## Upstream pin and regeneration

Artifacts are pinned to Jans v2.3.0 commit:

```text
f7c6e34be6ac8d585a9d7b6f7a12921b440b495b
```

The immutable source references are:

- [UniFFI crate](https://github.com/JanssenProject/jans/tree/f7c6e34be6ac8d585a9d7b6f7a12921b440b495b/jans-cedarling/bindings/cedarling_uniffi)
- [Android build](https://github.com/JanssenProject/jans/blob/f7c6e34be6ac8d585a9d7b6f7a12921b440b495b/jans-cedarling/bindings/cedarling_uniffi/Makefile)
- [TLS helper](https://github.com/JanssenProject/jans/blob/f7c6e34be6ac8d585a9d7b6f7a12921b440b495b/jans-cedarling/bindings/cedarling_uniffi/androidApp/app/src/main/java/org/jans/cedarling/CedarlingAndroid.kt)

Maintainers need Rust 1.95.0, `cargo-ndk`, Android NDK 29.0.14206865, and a checkout at the pinned revision:

```sh
ANDROID_NDK_HOME=/path/to/android-ndk-r29 \
  scripts/sync-cedarling-android.sh /path/to/jans
```

Use `--update` only for an intentional pin change followed by source/API review and the complete verification suite. The script builds `release` upstream libraries, discovers the generated Kotlin file from its declared package, copies four ABIs and the TLS/rustls helpers, then regenerates provenance and checksums. Gradle fails if packaged artifacts no longer match provenance.

## Policy archive fixture

Human-readable fixture sources are in `example/assets/policy-store`. Regenerate the deterministic root-layout archive with:

```sh
npm run build:policy-fixture
```

The example policy permits `ReactNativeExample::User::"alice"` with `role: "reader"` to perform `ReactNativeExample::Action::"Read"` on `ReactNativeExample::Document::"document-1"`. The same action is denied for guest `mallory` because no permit policy matches. The fixture has no issuer, token, network, or secret dependency. See `example/assets/fixtures/README.md` for its immutable upstream behavioral reference.

## Test

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run build:policy-fixture

cd example
npm install
npx expo prebuild --clean --platform android
cd android
NODE_ENV=test ./gradlew :cedarling-react-native:testDebugUnitTest
NODE_ENV=test ./gradlew :cedarling-react-native:connectedDebugAndroidTest -PcedarlingInstrumentationAbi=x86_64 -PreactNativeArchitectures=x86_64
NODE_ENV=production ./gradlew assembleRelease bundleRelease
```

Set both ABI properties to the connected device ABI (`x86` for an x86 emulator). The module restricts only the instrumentation artifact; ordinary builds still package all four ABIs. The runner explicitly selects the native lifecycle test so AndroidX does not scan a large all-dependency APK on memory-constrained emulators.

Run the example on an Android development build and press **Run native smoke tests**. The screen reports native initialization, archive URI resolution, ALLOW/DENY results, request IDs, reason IDs, errors, and timings. **Dispose and reinitialize** verifies the public lifecycle path.

## Release, minification, and 16 KB pages

The example targets/compiles Android API 36, enables Hermes and R8 resource/code shrinking for release, and consumes JNA/UniFFI/rustls keep rules from the library.

After building both release artifacts:

```sh
npm run verify:android-artifacts
```

That command verifies checksums, four ELF ABIs, GNU RELRO, 16 KiB LOAD alignment, npm contents and size, required 64-bit APK/AAB entries, and:

```sh
zipalign -c -P 16 -v 4 example/android/app/build/outputs/apk/release/app-release.apk
```

Set `BUNDLETOOL_JAR` to also require `PAGE_ALIGNMENT_16K` in the AAB bundle config. Runtime verification passed the real native lifecycle and ALLOW/DENY test on Android 17/API 37 x86_64 with `adb shell getconf PAGE_SIZE` reporting `16384`. The same test passed on Android 7.1.1/API 25 x86 with a 4 KiB page size. The minified universal release APK also installed and passed the public example ALLOW/DENY and dispose/reinitialize smoke paths.

## Security limitations

- A mobile client, its policy archive, bootstrap, tokens, and native code can be inspected or modified on a compromised device.
- Backend services must authenticate and independently authorize protected operations.
- Unsigned authorization is suitable only when its entity attributes come from a trustworthy local context; user-controlled attributes are not trustworthy evidence.
- Multi-issuer JWT verification may perform network access for JWKS and status data. TLS verification remains enabled; the module does not enable cleartext traffic or bypass certificates.
- Do not embed production secrets in bootstrap JSON, entities, policies, or the application bundle.
- Treat DENY and every initialization, parsing, archive, bridge, or native error as fail-closed.
- Update the pinned native binary promptly for relevant Cedarling, Rust, JNA, rustls, or Android security releases.

## Licenses

This package is Apache-2.0. Generated and copied upstream headers are preserved. See `THIRD_PARTY_NOTICES.md` for bundled dependency attribution.
