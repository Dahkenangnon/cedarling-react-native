# cedarling-react-native

Expo module for running Jans Cedarling inside Android and iOS React Native applications.

> Authorization performed in a mobile client can control local user experience and provide defense in depth, but the client is not a trusted enforcement boundary. Backend services must independently authenticate the request and re-evaluate authorization for protected operations.

## Architecture

The package follows the same native architecture on both platforms:

```text
React Native TypeScript
  -> Expo Modules API
  -> serialized Kotlin or Swift service
  -> generated Kotlin or Swift UniFFI binding
  -> libcedarling_uniffi.so or CedarlingNative.xcframework
  -> Cedarling Rust core
```

Native UniFFI is used because Cedarling already provides this binding and the Expo Modules API supplies the supported React Native bridge. There is no WASM runtime, WebView, remote authorization sidecar, custom C++ bridge, or policy evaluator duplicated in TypeScript, Kotlin, or Swift.

The npm package contains the generated bindings, Android TLS support, Android release shared libraries, and a static iOS XCFramework. Consumer installation, CocoaPods installation, application builds, and runtime require no Rust toolchain, Jans checkout, or native-artifact download.

## Support

Version 0.1.0 supports:

- Expo SDK 57 and React Native 0.86.2 with Hermes and the New Architecture;
- Android API 24 or newer on `armeabi-v7a`, `arm64-v8a`, `x86`, and `x86_64`;
- iOS 17.5 or newer on arm64 iPhone devices and Apple-silicon arm64 simulators.

The verified build stack is Expo 57.0.15, Expo Modules Core 57.0.12, React Native 0.86.2, React 19.2.3, Node.js 22.13.1, Android Gradle Plugin 8.12.0, Gradle 9.3.1, compile/target API 36, JNA 5.19.1, Xcode 26.4, and Rust 1.95.0. Android artifacts use NDK 29.0.14206865. Expo 57 itself permits iOS 16.4, but the exact pinned Jans Apple C/C++ and Rust linker configuration sets 17.5, so this package intentionally uses the higher compatible minimum. iOS CI deliberately uses the standard Apple-silicon `macos-26` runner because the pinned upstream build provides `aarch64-apple-ios-sim`, not an x86_64 simulator slice.

Web imports remain safe, but operations reject with `E_UNSUPPORTED_PLATFORM`. The package does not run in Expo Go because it contains native code; use an Expo development or release build.

## Install

```sh
npm install cedarling-react-native expo-asset
```

Create a native development build after installing or changing the module:

```sh
npx expo prebuild --platform android # or ios on macOS
npx expo run:android                 # or expo run:ios on macOS
```

For this repository:

```sh
npm install
cd example
npm install
npx expo prebuild --clean --platform android
npx expo run:android
```

For iOS, replace `android` with `ios`. CocoaPods consumes the vendored XCFramework from the package and performs no Cedarling download.

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

`file://` and validated absolute paths work on both platforms. Android additionally supports `content://` through `ContentResolver`; iOS Expo assets resolve to local `file://` URLs. `http://` and `https://` archive URLs are rejected at this boundary. Configure any supported remote store in Cedarling bootstrap JSON instead.

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

Initialization and authorization use Expo `AsyncFunction`. Android performs blocking work on `Dispatchers.IO` behind a coroutine `Mutex`; iOS uses a dedicated serial `DispatchQueue`. Both serialize initialization, authorization, replacement, and disposal around one retained Cedarling instance.

Android TLS initialization is lazy and receives only `context.applicationContext`. Reinitialization constructs a complete replacement before swapping it in, so failure leaves the previous instance active. `dispose()` shuts down and releases the generated UniFFI object; a later `initialize()` is supported. Expo module destruction schedules the same serialized release. Swift UniFFI lifetime is managed by ARC; Kotlin additionally calls its generated `destroy()` method.

## Native artifacts and size

The package supports:

| ABI         | Library                  | Source bytes |
| ----------- | ------------------------ | -----------: |
| armeabi-v7a | `libcedarling_uniffi.so` |   19,145,520 |
| arm64-v8a   | `libcedarling_uniffi.so` |   28,395,176 |
| x86         | `libcedarling_uniffi.so` |   28,422,072 |
| x86_64      | `libcedarling_uniffi.so` |   28,979,384 |

Exact byte sizes and SHA-256 values are recorded in `android/cedarling-native/UPSTREAM.json` after synchronization. The full npm tarball and per-ABI sizes are reported by `npm run verify:android-artifacts`.

The iOS payload contains one static XCFramework with two arm64 slices:

| Slice                   | Rust target             |
| ----------------------- | ----------------------- |
| iPhone device           | `aarch64-apple-ios`     |
| Apple-silicon simulator | `aarch64-apple-ios-sim` |

`ios/cedarling-native/UPSTREAM.json` records the exact bytes and SHA-256 of both archives, public headers, module maps, generated Swift, and framework metadata. `npm run verify:package` reports packed and unpacked npm size across both platforms.

## Upstream pin and regeneration

Artifacts are pinned to Jans v2.3.0 commit:

```text
f7c6e34be6ac8d585a9d7b6f7a12921b440b495b
```

The immutable source references are:

- [UniFFI crate](https://github.com/JanssenProject/jans/tree/f7c6e34be6ac8d585a9d7b6f7a12921b440b495b/jans-cedarling/bindings/cedarling_uniffi)
- [Android and iOS build](https://github.com/JanssenProject/jans/blob/f7c6e34be6ac8d585a9d7b6f7a12921b440b495b/jans-cedarling/bindings/cedarling_uniffi/Makefile)
- [Apple target configuration](https://github.com/JanssenProject/jans/blob/f7c6e34be6ac8d585a9d7b6f7a12921b440b495b/jans-cedarling/.cargo/config.toml)
- [TLS helper](https://github.com/JanssenProject/jans/blob/f7c6e34be6ac8d585a9d7b6f7a12921b440b495b/jans-cedarling/bindings/cedarling_uniffi/androidApp/app/src/main/java/org/jans/cedarling/CedarlingAndroid.kt)

Android maintainers need Rust 1.95.0, `cargo-ndk`, Android NDK 29.0.14206865, and a checkout at the pinned revision:

```sh
ANDROID_NDK_HOME=/path/to/android-ndk-r29 \
  scripts/sync-cedarling-android.sh /path/to/jans
```

Use `--update` only for an intentional pin change followed by source/API review and the complete verification suite. The script builds `release` upstream libraries, discovers the generated Kotlin file from its declared package, copies four ABIs and the TLS/rustls helpers, then regenerates provenance and checksums. Gradle fails if packaged artifacts no longer match provenance.

iOS synchronization must run on macOS with Xcode 26.4, Node.js, `protoc` 31.1, and the same exact Jans checkout:

```sh
scripts/sync-cedarling-ios.sh /path/to/jans
```

The command rejects a mismatched or dirty checkout unless `--allow-dirty` is deliberately supplied. It installs Rust 1.95.0 and the two reviewed Apple targets, enforces the pinned Jans `Cargo.lock` for every Cargo command, builds the host library required by UniFFI, generates the official Swift binding, builds both static libraries, strips only debug symbols, reindexes the archives, creates the XCFramework, and rewrites checksummed provenance. `npm run verify:native-pins` rejects Android/iOS pin drift; `npm run verify:ios-artifacts` validates locked-build provenance, the 100 MiB Git blob ceiling, framework structure, headers, module maps, architectures, deployment metadata, package contents, and local-path leakage.

Maintainers can also run **Regenerate iOS native artifacts** manually in GitHub Actions. It uses the immutable Jans commit and reviewed tool versions, uploads output for inspection, and never commits or changes the pin.

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
npm run verify:autolinking
npm run verify:native-pins
npm run verify:package

cd example
npm install
npx expo prebuild --clean --platform android
cd android
NODE_ENV=test ./gradlew :cedarling-react-native:testDebugUnitTest
NODE_ENV=test ./gradlew :cedarling-react-native:connectedDebugAndroidTest -PcedarlingInstrumentationAbi=x86_64 -PreactNativeArchitectures=x86_64
NODE_ENV=production ./gradlew assembleRelease bundleRelease
```

On a Mac with Xcode 26.4:

```sh
cd example
npx expo prebuild --clean --platform ios --no-install
cp ios-lock/Podfile.lock ios/Podfile.lock
pod install --project-directory=ios --deployment
cd ..
ruby scripts/configure-ios-tests.rb
xcodebuild test \
  -workspace example/ios/CedarlingReactNativeExample.xcworkspace \
  -scheme CedarlingReactNativeExample-NativeTests \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=<available iPhone>,OS=latest' \
  -only-testing:CedarlingReactNativeExampleTests \
  CODE_SIGNING_ALLOWED=NO
xcodebuild test \
  -workspace example/ios/CedarlingReactNativeExample.xcworkspace \
  -scheme CedarlingReactNativeExample-UITests \
  -configuration Release \
  -destination 'platform=iOS Simulator,name=<available iPhone>,OS=latest' \
  -only-testing:CedarlingReactNativeExampleUITests \
  CODE_SIGNING_ALLOWED=NO
xcodebuild build \
  -workspace example/ios/CedarlingReactNativeExample.xcworkspace \
  -scheme CedarlingReactNativeExample \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
```

The configurator creates separate shared native-test and UI-test schemes while preserving Expo's app scheme for ordinary and generic-device builds. Native tests cover archive bounds, JSON conversion, result consistency, stable errors, transactional replacement, real ALLOW/DENY, disposal, reinitialization, and serialized concurrency. The release UI test launches the app and traverses JavaScript → Swift → UniFFI → Rust, verifies `ALLOW` with `allow_reader`, guest `DENY`, overall `PASS`, and a second completed run after dispose/reinitialize.

Set both ABI properties to the connected device ABI (`x86` for an x86 emulator). The module restricts only the instrumentation artifact; ordinary builds still package all four ABIs. The runner explicitly selects the native lifecycle test so AndroidX does not scan a large all-dependency APK on memory-constrained emulators.

Run the example development build on either platform and press **Run native smoke tests**. The screen reports native initialization, archive URI resolution, ALLOW/DENY results, request IDs, reason IDs, errors, timings, and completed runs. **Dispose and reinitialize** verifies the public lifecycle path.

## Continuous integration

`.github/workflows/ci.yml` runs for pull requests targeting `main`, pushes to `main`, and manual dispatch. It has read-only repository permissions, uses `pull_request` rather than `pull_request_target`, pins every action to a full commit SHA, and requires no Apple signing credentials.

- **JavaScript and package:** locked installs, high-severity audits, lint, root/example typechecks, Jest, build, deterministic fixture, synchronized native pins, native hashes, and both npm payloads.
- **Android JVM, lint, and release:** clean Expo prebuild, Kotlin/JVM tests, Android lint, minified APK/AAB builds, checksums, ABIs, RELRO, 16 KiB ELF alignment, APK zip alignment, and the SHA-verified Bundletool AAB configuration.
- **Android real native runtime:** API 36 x86_64 AOSP automated-test device on the standard Intel `macos-15-intel` runner, with the real Cedarling instrumentation lifecycle/ALLOW/DENY test.
- **iOS:** standard arm64 `macos-26`, Xcode 26.4, locked pods, native XCTest, release simulator UI smoke, and unsigned generic-device compile/link.

Logs, test results, release APK/AAB, XCResult bundles, and the unsigned device build are retained briefly as workflow artifacts. Standard GitHub-hosted runners are free for this public repository. If the repository becomes private again, macOS jobs consume the account's included Actions allowance; [GitHub's current hosted-runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing) lists standard macOS at USD 0.062 per minute beyond that allowance. This workflow uses standard Intel macOS for the Android emulator and standard arm64 macOS for iOS; it does not select larger runners.

## Test on a physical iPhone later

The current verification compiles the device slice without signing and runs on an iOS simulator. It is not a physical-iPhone validation.

For direct local testing, a friend with a Mac can clone this repository, install the locked dependencies, run the iOS prebuild/pod steps above, open `example/ios/CedarlingReactNativeExample.xcworkspace`, select their Apple Development Team and connected iPhone, choose a bundle identifier available to that team if necessary, and run the example from Xcode.

For remote distribution, TestFlight is the recommended path. It requires Apple Developer membership, a unique bundle identifier, signing and provisioning, and App Store Connect access. Ad Hoc distribution is possible but requires registering the friend's device UDID. No certificate, private key, provisioning profile, App Store Connect key, or signed CI workflow belongs in this repository until a distribution method and protected release environment are explicitly approved.

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
