# Cedarling React Native technical guide

## Purpose and scope

This experiment evaluates whether the existing Jans Cedarling UniFFI binding can provide embedded authorization to React Native applications without reimplementing Cedar policy evaluation.

The package targets two consumer environments:

1. React Native Community CLI 0.86.2 with no Expo dependency.
2. Expo SDK 57 using a native development or release build.

Both environments use the same public TypeScript API, React Native Codegen contract, native services, generated UniFFI bindings, and vendored Rust libraries. Expo Go is outside the supported boundary because its prebuilt client cannot load arbitrary native modules or custom Rust binaries.

The implementation remains experimental and is not published to npm.

## Concepts

### React Native

React Native renders platform-native UI while running application logic in JavaScript or TypeScript. JavaScript cannot call a Rust function directly. A native module provides the explicit boundary between JavaScript and the Android or iOS runtime.

### Hermes

Hermes is the JavaScript engine used by both examples. It executes the application bundle and invokes the generated TurboModule proxy. Hermes does not execute Cedarling policy logic; authorization remains in the native Rust library.

### Codegen

React Native Codegen reads `src/NativeCedarlingReactNative.ts`. That file describes the private native transport as a `TurboModule` interface. Codegen produces:

- an abstract Java/Kotlin-compatible specification for Android;
- an Objective-C protocol and C++ JSI glue for iOS;
- method metadata used by the New Architecture runtime.

Codegen supports a deliberately restricted set of cross-language types. Complex Cedarling values therefore cross this private boundary as JSON strings. This restriction is internal and does not change the public typed API.

### TurboModule

A TurboModule is a React Native native module exposed through the New Architecture. `TurboModuleRegistry.getEnforcing` resolves `CedarlingReactNative`. Resolution fails immediately when native autolinking or registration is missing.

The package uses one standard React Native TurboModule for both Expo and bare applications. An Expo application can consume an ordinary React Native native module; the module itself does not need the Expo Modules API.

### UniFFI

UniFFI generates language bindings from a Rust API. Cedarling's existing binding produces Kotlin-facing declarations for Android and Swift-facing declarations for iOS. Those generated declarations marshal values and call the Rust library through its C-compatible foreign-function interface.

UniFFI and React Native solve different boundaries:

| Boundary                         | Responsibility                                     |
| -------------------------------- | -------------------------------------------------- |
| React Native Codegen/TurboModule | JavaScript or Hermes to Kotlin/Objective-C++/Swift |
| Cedarling UniFFI                 | Kotlin or Swift to the Cedarling Rust library      |

Neither boundary replaces the other.

## Complete call path

An unsigned authorization call follows this path:

    Cedarling.authorizeUnsigned(request)
      → TypeScript input validation and JSON serialization
      → TurboModuleRegistry proxy
      → generated React Native Codegen method
      → Android CedarlingReactNativeModule
         or iOS CedarlingReactNative Objective-C++ adapter
      → platform CedarlingService
      → generated cedarling_uniffi Kotlin or Swift binding
      → UniFFI C ABI
      → vendored Cedarling Rust library
      → native result mapping
      → JSON transport string
      → TypeScript validation and public CedarlingAuthorizeResult

The Rust core makes the authorization decision. Kotlin, Swift, Objective-C++, and TypeScript validate, marshal, schedule, and map the call.

## Public and private TypeScript layers

`src/index.ts` exposes the stable API and types. `createCedarlingApi` performs public-boundary work:

- validates nonempty actions, identifiers, issuer values, and context keys;
- validates Cedar entity mappings;
- rejects malformed or non-finite JSON;
- serializes bootstrap, entity, context, token, and data-context inputs;
- maps native values to stable public result types;
- normalizes native errors to documented `CedarlingError` codes;
- rejects inconsistent authorization results.

`NativeCedarlingReactNative.ts` is private transport. Arrays, maps, result records, data entries, statistics, provenance, and issuer summaries are JSON encoded natively. `turboModuleAdapter.ts` decodes them before the existing mapping layer validates their shape. An invalid native JSON payload becomes `E_NATIVE_RESULT_INCONSISTENT`.

Individual raw Cedarling log records remain exact strings. They are not parsed and rewritten by the transport adapter.

## Android implementation

### Registration and Codegen

`CedarlingReactNativePackage` is a standard `BaseReactPackage`. React Native autolinking instantiates it, and `CedarlingReactNativeModule` extends the generated `NativeCedarlingReactNativeSpec`.

The module contains no Expo runtime dependency. The historical Kotlin namespace `expo.modules.cedarling` is only a Java package name and does not imply Expo Modules API usage.

### Service and threading

JavaScript promise calls enter a module coroutine scope. `CedarlingService` moves native work to `Dispatchers.IO` and serializes lifecycle-sensitive operations with a `Mutex`.

Initialization is transactional:

1. Validate bootstrap JSON and the archive location.
2. Read the bounded local archive.
3. Construct a replacement UniFFI Cedarling object.
4. Swap the live instance only after construction succeeds.
5. Destroy the previous UniFFI object explicitly.

A failed replacement leaves the prior live instance available. `dispose` and React Native `invalidate` destroy the native object.

### Rust loading

The generated Kotlin binding uses JNA to reach `libcedarling_uniffi.so`. Four release libraries are packaged:

- `armeabi-v7a`;
- `arm64-v8a`;
- `x86`;
- `x86_64`.

The Android build preserves API 24 minimum support, JNA, the Rust TLS platform verifier, R8 consumer rules, GNU RELRO checks, 16 KiB ELF LOAD alignment, and APK/AAB page-alignment verification.

The bare example reads `asset:///policy-store.cjar` through Android `AssetManager`. File and `content://` locations remain supported. Asset paths reject authorities, queries, fragments, empty components, and traversal components.

## iOS implementation

### Codegen adapter

React Native's generated iOS interface is Objective-C based. `CedarlingReactNative.mm` is the minimum Objective-C++ adapter:

- conforms to the generated `NativeCedarlingReactNativeSpec` protocol;
- forwards promise methods to `CedarlingReactNativeBridge.swift`;
- returns the generated `NativeCedarlingReactNativeSpecJSI` object;
- maps stable error codes into React Native promise rejections.

Policy evaluation is not implemented in Objective-C++.

### Swift service and serialization

`CedarlingReactNativeBridge` forwards work to the existing Swift `CedarlingService`. The service owns a serial `DispatchQueue`, validates inputs, manages the UniFFI object, maps results, and preserves transactional reinitialization.

Complex results are serialized with `JSONSerialization`. A missing data-context entry is encoded as JSON `null`. Unexpected serialization or result disagreement fails closed.

### Rust loading

The generated `cedarling_uniffi.swift` file calls the UniFFI C ABI exported by a static `CedarlingNative.xcframework`. The XCFramework contains:

- an arm64 iPhone device slice;
- an arm64 Apple-silicon simulator slice.

The deployment target is iOS 17.5. The CocoaPods specification installs React Native's Codegen dependencies and links the static XCFramework without Expo Modules Core.

The bare application embeds the shared fixture and reads `bundle:///policy-store.cjar`. Bundle paths are standardized and constrained to `Bundle.main.resourceURL`; authority, query, fragment, and traversal inputs are rejected.

## Error, lifecycle, and security behavior

Stable errors distinguish unsupported platforms, invalid inputs, invalid JSON, archive I/O and size failures, initialization, authorization, logging, data context, inconsistent native results, and unexpected native failures.

Important invariants include:

- native decision and `allowed` Boolean values must agree;
- request IDs must be nonempty;
- malformed native JSON never becomes a public value;
- replacement initialization does not destroy a working instance before the replacement succeeds;
- native instances are explicitly destroyed on disposal and lifecycle invalidation;
- archive input is local, bounded to 10 MiB, and protected from traversal;
- multi-issuer authorization is not reported as successful without trusted issuer material and real signed tokens.

The mobile process is not a trusted security boundary. An attacker controlling a device or application process may inspect or modify local inputs, policies, results, and logs. Server-side protected operations require independent authentication and authorization.

## Upstream Jans vendoring

The vendored binding is pinned to Jans v2.3.0 at:

    f7c6e34be6ac8d585a9d7b6f7a12921b440b495b

Android payload:

- generated `cedarling_uniffi.kt`;
- four `libcedarling_uniffi.so` libraries;
- JNA and pinned Android TLS support artifacts.

iOS payload:

- generated `cedarling_uniffi.swift`;
- static `CedarlingNative.xcframework` device and simulator libraries;
- public UniFFI C headers and module maps.

`PINNED_REVISION`, `SHA256SUMS`, and `UPSTREAM.json` under each platform directory record the revision, release, toolchain, targets, commands, sizes, and checksums. Verification rejects pin disagreement, checksum changes, missing architectures, invalid alignment, dynamic iOS payloads, and machine-local paths.

The synchronization scripts require an exact clean Jans checkout. Native artifacts are not downloaded during consumer builds. Regeneration is unnecessary for a React Native bridge-only change and must not occur without an upstream or toolchain reason.

## Expo application support

The Expo example is under `example/` and uses Expo SDK 57 with React Native 0.86.2, Hermes, and the New Architecture.

Expo Autolinking delegates ordinary React Native dependency discovery to the React Native configuration. It finds:

- the Android Gradle library and `CedarlingReactNativePackage`;
- the iOS `CedarlingReactNative.podspec`;
- the `CedarlingReactNativeSpec` Codegen library name.

Only the application shell uses `expo-asset` to obtain a local URI for the bundled archive. A clean `expo prebuild` generates the native application projects used in CI.

Expo Go remains unsupported because installing a JavaScript dependency cannot add the vendored `.so` files, XCFramework, generated bindings, or TurboModule registration to the prebuilt Expo Go binary.

## Expo-free bare React Native support

The bare example is under `bare-example/`. Its dependency graph contains React, React Native, the Community CLI tooling, and the local Cedarling package; it contains no Expo package, Expo CLI, EAS, or Expo autolinking configuration.

The checked-in `android/` and `ios/` projects use standard React Native Gradle, CocoaPods, Codegen, and autolinking integration. The native shells are independent from the Expo-generated projects, while the demo screen and fixtures are shared.

This separation tests the relevant consumer condition: the package works as an ordinary React Native native library, and Expo compatibility is supplied by Expo's support for ordinary React Native libraries.

## Demo coverage

Both applications expose equivalent behavior and stable automation identifiers:

- one deterministic reader ALLOW request;
- guest and anonymous DENY requests;
- selectable request JSON and independent execution;
- a stable combined ALLOW/DENY native smoke path;
- initialization, status, native provenance, and lifecycle operations;
- all raw log lookup, filter, refresh, pop, and display operations;
- data-context push, get, entry, list, statistics, remove, and clear operations;
- trusted-issuer summary, name lookup, and issuer URL lookup;
- a formal limitation message for unavailable offline multi-issuer success;
- a realtime trace with timestamp, operation, sanitized input, sanitized output or error, and duration;
- an exact raw-memory-log panel with an explicit sensitive-data warning.

The diagnostics panel is a development aid. Raw logs and authorization inputs may contain personal, security-sensitive, or token data and must not be exposed in production interfaces or unrestricted telemetry.

## CI verification and review artifacts

The workflow runs for pull requests to `main`, pushes to `main`, and manual dispatch. It uses read-only repository permissions, `pull_request` rather than `pull_request_target`, pinned third-party actions, GitHub-hosted runners, and concurrency cancellation.

Package checks cover locked JavaScript installs, dependency audits, lint, type checking, Jest, build output, Codegen, dual autolinking, native pins and checksums, deterministic fixtures, and npm payload contents.

For each Expo and bare Android application, CI:

- generates the Expo project when applicable;
- runs Codegen, JVM tests, Android lint, and real vendored-Rust instrumentation;
- builds release APK and AAB outputs;
- verifies all four ABIs, RELRO, 16 KiB alignment, JNA, and bundle page-alignment metadata;
- runs the release app on an API 36 x86_64 emulator;
- executes the real JavaScript-to-Rust ALLOW/DENY UI path;
- requires a downloadable PASS PNG;
- retains a failure PNG, logcat, test reports, UI hierarchy, and available MP4.

For each Expo and bare iOS application, CI:

- installs CocoaPods dependencies and verifies Cedarling autolinking;
- runs native Swift tests against the real vendored Rust simulator slice;
- runs the JavaScript-to-Rust ALLOW/DENY path in an arm64 iPhone Simulator;
- stores a keep-always XCTest screenshot attachment and a directly downloadable PNG;
- retains failure screenshots, simulator video, logs, and complete XCResult bundles;
- compiles and links an unsigned generic arm64 iPhone build.

Artifact names contain the platform, application type, and commit SHA and are retained for seven days.

## What CI does and does not establish

iPhone Simulator tests and unsigned generic-device linking do not require a physical iPhone, an Apple Developer account, a certificate, or a provisioning profile. Successful CI establishes that the arm64 simulator slice executes and that the device slice compiles and links without signing.

Those checks do not establish:

- installation or execution on physical iPhone hardware;
- behavior under a specific device's memory, thermal, or storage pressure;
- App Store signing, provisioning, archive export, review, or distribution;
- production policy design or server-side enforcement correctness.

Physical-device validation and signed distribution remain separate release activities.

## Production considerations

Before production use:

- perform a security review of policies, bootstrap configuration, archive distribution, and logging;
- disable or remove the raw diagnostics UI;
- avoid embedding secrets or production tokens;
- validate performance and lifecycle behavior on representative physical devices;
- define upgrade and provenance review procedures for the Jans pin;
- run signed release and distribution testing;
- enforce all protected operations again on a trusted backend.
