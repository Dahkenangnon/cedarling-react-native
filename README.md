# cedarling-react-native

Experimental React Native bindings for running [Jans Cedarling](https://github.com/JanssenProject/jans/tree/main/jans-cedarling) inside Android and iOS applications.

> [!IMPORTANT]
> This package is experimental and is not published to npm. An `npm install cedarling-react-native` command does not currently install this repository. Use a checkout or a local `file:` dependency.

## Supported environments

- React Native Community CLI 0.86.2 with no Expo dependency.
- Expo SDK 57 in a native development or release build.
- Hermes and React Native's New Architecture.
- Android API 24+ on `armeabi-v7a`, `arm64-v8a`, `x86`, and `x86_64`.
- iOS 17.5+ on arm64 devices and Apple-silicon arm64 simulators.

Expo Go is unsupported because it cannot load this package's custom native Rust binaries.

The package uses React Native Codegen and a TurboModule; it does not depend on `expo` or `expo-modules-core`. The Expo example uses Expo APIs only in its application shell.

## Architecture

    Application TypeScript
      → validated public Cedarling API
      → private Codegen TurboModule transport
      → Kotlin or Swift CedarlingService
      → generated UniFFI bindings
      → vendored Cedarling Rust library

There is no WebView, WASM runtime, remote authorization sidecar, or policy evaluator rewritten in JavaScript.

## Repository development

    git clone https://github.com/Dahkenangnon/cedarling-react-native.git
    cd cedarling-react-native
    npm ci
    npm --prefix example ci
    npm --prefix bare-example ci
    npm test
    npm run build

## Run the Expo example

    cd example
    npx expo prebuild --clean --platform android --no-install
    npx expo run:android

On macOS, use `--platform ios` and `npx expo run:ios`. This is a native build, not Expo Go.

## Run the bare React Native example

    cd bare-example
    npx react-native run-android

On macOS, run `cd ios && pod install && cd ..`, then `npx react-native run-ios`.

Both examples share the same demo and offline policy fixture. They expose selectable ALLOW/DENY requests, a complete API explorer, exact raw Cedarling memory logs, and a realtime JavaScript-to-native trace.

## Public API

    import { Cedarling, CedarlingError } from 'cedarling-react-native';

    await Cedarling.initialize({
      bootstrap: {
        CEDARLING_APPLICATION_NAME: 'Example',
        CEDARLING_LOG_LEVEL: 'INFO',
        CEDARLING_LOG_TYPE: 'memory',
      },
      policyStore: { kind: 'archive', uri: localArchiveUri },
    });

    const result = await Cedarling.authorizeUnsigned({
      principal: {
        cedar_entity_mapping: { entity_type: 'Example::User', id: 'alice' },
        role: 'reader',
      },
      action: 'Example::Action::"Read"',
      resource: {
        cedar_entity_mapping: { entity_type: 'Example::Document', id: 'document-1' },
      },
      context: {},
    });

    console.log(result.decision, result.requestId, result.diagnostics);

The stable API also includes:

- `initialize`, `isInitialized`, `dispose`, and `getNativeInfo`;
- unsigned and multi-issuer authorization;
- raw log lookup, filtering, and draining;
- data-context push, read, list, statistics, remove, and clear operations;
- trusted-issuer status and summary diagnostics;
- `CedarlingError` with stable error codes.

All authorization result inconsistencies fail closed. Web imports remain safe, but operations reject with `E_UNSUPPORTED_PLATFORM`.

## Vendored native artifacts

The repository vendors UniFFI bindings and native libraries from Jans v2.3.0 at commit:

    f7c6e34be6ac8d585a9d7b6f7a12921b440b495b

Android contains generated Kotlin plus four `libcedarling_uniffi.so` files. iOS contains generated Swift plus a static XCFramework with arm64 device and simulator slices. Checksums, build inputs, and provenance are recorded under `android/cedarling-native/` and `ios/cedarling-native/`.

Consumer builds do not need Rust, a Jans checkout, or a native download.

## Verification and CI evidence

    npm run lint
    npm run typecheck
    npm test
    npm run build
    npm run verify:autolinking
    npm run verify:native-pins
    npm run verify:package

The [CI workflow](https://github.com/Dahkenangnon/cedarling-react-native/actions/workflows/ci.yml) is configured to build and exercise Expo and bare applications on Android and iOS. Each runtime job uploads a PASS screenshot plus logs, reports, available video, and—in iOS jobs—the complete XCResult bundle. Simulator and unsigned device-link checks require neither an Apple Developer account nor signing credentials.

## Documentation

- [Technical guide](docs/README.md)
- [Offline fixture](example/assets/fixtures/README.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Security boundary

Client-side authorization is defense in depth, not a trusted server-side enforcement boundary. A compromised application can be inspected or modified. Backend services must authenticate and independently authorize protected operations. Never bundle production secrets or expose raw authorization inputs and logs in production UI or telemetry.

## License

Apache-2.0. Bundled upstream components retain their own notices; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
