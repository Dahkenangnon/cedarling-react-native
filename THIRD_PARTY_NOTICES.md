# Third-party notices

`cedarling-react-native` includes or packages the following third-party software. Copyright and license notices in copied/generated source and archives remain in effect.

## Jans Cedarling

- Project: Janssen Project Cedarling
- Version: 2.3.0; UniFFI crate 0.1.0
- Source: https://github.com/JanssenProject/jans/tree/f7c6e34be6ac8d585a9d7b6f7a12921b440b495b/jans-cedarling
- License: Apache License 2.0

The generated Kotlin and Swift bindings, each Android `libcedarling_uniffi.so`, and both static libraries in `CedarlingNative.xcframework` are built from the exact commit above. Cedarling and its statically linked Rust dependency graph remain subject to their respective licenses; authoritative package versions are captured by the pinned Jans `Cargo.lock`.

## UniFFI

- Project: Mozilla UniFFI
- Version: 0.29.5
- Source: https://github.com/mozilla/uniffi-rs/tree/v0.29.5
- License: Mozilla Public License 2.0

UniFFI generated the Kotlin and Swift foreign-function bindings and the C header/module-map interface bundled by this package. Generated source retains its upstream notice.

## Java Native Access

- Project: JNA
- Version: 5.19.1
- Source: https://github.com/java-native-access/jna/tree/5.19.1
- License: Apache License 2.0 or GNU Lesser General Public License 2.1 or later

The Android AAR is resolved from Maven at consumer build time and includes JNA's `libjnidispatch` native libraries. This project consumes it under the Apache License 2.0 option.

## rustls-platform-verifier Android

- Project: rustls-platform-verifier
- Android artifact version: 0.1.1
- Source: https://github.com/rustls/rustls-platform-verifier/tree/v0.1.1
- License: MIT or Apache License 2.0

The original Android AAR and POM are retained in `android/maven` for provenance. Its exact `classes.jar` is bundled in `android/libs` so Cedarling's Rust TLS verifier can invoke the platform certificate-verification bridge without requiring consumers to edit Gradle settings. This project consumes it under the Apache License 2.0 option.

## Cedar policy engine and native transitive dependencies

The Android shared libraries and iOS static archives incorporate the Cedar policy engine and other Rust crates selected by the pinned Jans lockfile, including cryptographic and TLS components. Their source code, copyright notices, and license expressions are available through the exact dependency graph produced by:

```sh
cargo metadata --locked --format-version 1 \
  --manifest-path jans-cedarling/bindings/cedarling_uniffi/Cargo.toml
```

This notice does not replace any license text or attribution carried by those projects. A release maintainer must review the locked dependency-license inventory whenever the Jans pin changes.

## License texts

The Apache License 2.0 text for this package and Jans Cedarling is in `LICENSE`. The full texts and notices for UniFFI, JNA, rustls-platform-verifier, and transitive Rust dependencies are available in the source distributions linked above and in their Maven/Cargo packages.
