# Offline native smoke-test fixture

The archive contains one policy, allow_reader, for the action
ReactNativeExample::Action::"Read" on a ReactNativeExample::Document.

- ALLOW: principal ReactNativeExample::User::"alice" has role "reader", so
  allow_reader applies.
- DENY: principal ReactNativeExample::User::"mallory" has role "guest", so
  no permit policy applies and Cedar denies by default.

The fixture has no trusted issuer, remote URL, production token, or network
dependency. The archive is built from example/assets/policy-store by
scripts/build-policy-fixture.sh, with files at the ZIP root.

Behavior and data shape were adapted from the Jans v2.3.0 unsigned fixture at
jans-cedarling/bindings/cedarling-java/src/test/resources/config/unsigned,
pinned to commit
f7c6e34be6ac8d585a9d7b6f7a12921b440b495b.
