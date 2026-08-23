# cedarling-react-native

React Native bindings for running [Jans Cedarling](https://github.com/JanssenProject/jans/tree/main/jans-cedarling) natively on Android and iOS.

> **Experimental and unpublished:** this package is not available on npm. The command
> `npm install cedarling-react-native` does not install this repository. Use the checked-out
> workspace and example app until a release is published.

## What it proves

The same TypeScript API reaches the real Cedarling Rust core on both mobile platforms:

```text
TypeScript → Expo Modules API → Kotlin / Swift → UniFFI → Cedarling Rust
```

The package includes:

- unsigned and multi-issuer authorization;
- raw in-memory log lookup and draining;
- Cedarling data-context storage and statistics;
- trusted-issuer diagnostics;
- deterministic lifecycle and native provenance APIs;
- an offline example with selectable ALLOW/DENY requests and realtime diagnostics.

No WebView, WASM runtime, remote authorization sidecar, or policy evaluator rewritten in
TypeScript is used.

## Platform support

| Platform | Supported target |
| --- | --- |
| Android | API 24+, `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64` |
| iOS | 17.5+, arm64 device and Apple-silicon arm64 simulator |
| Web | Import-safe; operations reject with `E_UNSUPPORTED_PLATFORM` |

The module targets Expo SDK 57, React Native 0.86, Hermes, and the New Architecture. It requires a
native development or release build and does not run in Expo Go.

It is built with Expo Modules API, but it is not limited to Expo-managed applications. A bare React
Native app can use it after installing and configuring the `expo` package and Expo module
autolinking. A fully Expo-free app would need a separate TurboModule/JSI adapter.

## Run the example

```sh
git clone https://github.com/Dahkenangnon/cedarling-react-native.git
cd cedarling-react-native
npm install
cd example
npm install
npx expo prebuild --clean --platform android
npx expo run:android
```

On macOS, replace `android` with `ios`. Press **Run native smoke tests** for the stable ALLOW/DENY
path, choose a request under **Authorization requests**, or run **Run complete API explorer**.

The bottom diagnostics panel displays the raw Cedarling memory-log JSON and a timestamped
JavaScript-to-native call trace. It uses only offline fixtures. Do not ship such a panel in a
production app because authorization inputs and logs may be sensitive.

## Basic usage

```ts
import { Asset } from 'expo-asset';
import { Cedarling } from 'cedarling-react-native';

const archive = Asset.fromModule(require('./assets/policy-store.cjar'));
await archive.downloadAsync();
if (!archive.localUri) throw new Error('Policy archive is unavailable');

await Cedarling.initialize({
  bootstrap: {
    CEDARLING_APPLICATION_NAME: 'My mobile app',
    CEDARLING_LOG_LEVEL: 'INFO',
    CEDARLING_LOG_TYPE: 'memory',
  },
  policyStore: { kind: 'archive', uri: archive.localUri },
});

const result = await Cedarling.authorizeUnsigned({
  principal: {
    cedar_entity_mapping: { entity_type: 'MyApp::User', id: 'alice' },
    role: 'reader',
  },
  action: 'MyApp::Action::"Read"',
  resource: {
    cedar_entity_mapping: { entity_type: 'MyApp::Document', id: 'document-1' },
  },
  context: {},
});

console.log(result.decision, result.requestId, result.diagnostics);
console.log(await Cedarling.getLogsByRequestId(result.requestId));
```

All failures reject with `CedarlingError`. Authorization inconsistencies fail closed and never
become ALLOW.

## Native artifacts

Artifacts are vendored from Jans v2.3.0 at commit
`f7c6e34be6ac8d585a9d7b6f7a12921b440b495b`:

- Android: generated Kotlin, four release `libcedarling_uniffi.so` libraries, and Android TLS
  support;
- iOS: generated Swift and a static XCFramework containing arm64 device and simulator slices.

Checksums, tool versions, targets, and source revision are recorded in
`android/cedarling-native/UPSTREAM.json` and `ios/cedarling-native/UPSTREAM.json`. Consumer builds
do not need Rust, a Jans checkout, or a native download.

Maintainers regenerate artifacts with:

```sh
ANDROID_NDK_HOME=/path/to/android-ndk-r29 \
  scripts/sync-cedarling-android.sh /path/to/pinned/jans

# macOS only
scripts/sync-cedarling-ios.sh /path/to/pinned/jans
```

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:native-pins
npm run verify:package
```

GitHub Actions repeats JavaScript/package checks, Android JVM/lint/release builds, a real Android
emulator test, iOS native tests, an iOS Simulator UI smoke test, and an unsigned generic iPhone
build. No Apple signing credentials are required for these CI checks.

## Learn more

- [Offline fixture](example/assets/fixtures/README.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Security

Mobile authorization is defense in depth, not a trusted server-side enforcement boundary. A
compromised client can be inspected or modified. Backend services must authenticate and
independently authorize protected operations. Never embed production secrets in bootstrap,
policies, entities, tokens, logs, or the application bundle.

## License

Apache-2.0. Bundled upstream components retain their own notices; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
