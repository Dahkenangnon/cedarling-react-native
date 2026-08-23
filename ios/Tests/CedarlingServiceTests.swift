import Foundation
import XCTest
@testable import CedarlingReactNative

final class CedarlingServiceTests: XCTestCase {
  private let action = #"ReactNativeExample::Action::"Read""#

  func testRealAllowDenyReplacementAndReinitialize() throws {
    let service = CedarlingService()
    let fixture = try loadFixture()

    try service.initialize(
      bootstrapJson: fixture.bootstrap,
      archiveUri: fixture.archive.absoluteString
    )
    XCTAssertTrue(try service.isInitialized())

    let allow = try service.authorizeUnsigned(
      principalJson: fixture.allowPrincipal,
      action: action,
      resourceJson: fixture.resource,
      contextJson: "{}"
    )
    XCTAssertEqual(allow["allowed"] as? Bool, true)
    XCTAssertEqual(allow["decision"] as? String, "ALLOW")
    let diagnostics = try XCTUnwrap(allow["diagnostics"] as? [String: Any])
    XCTAssertTrue((diagnostics["reasons"] as? [String])?.contains("allow_reader") == true)

    let deny = try service.authorizeUnsigned(
      principalJson: fixture.denyPrincipal,
      action: action,
      resourceJson: fixture.resource,
      contextJson: "{}"
    )
    XCTAssertEqual(deny["allowed"] as? Bool, false)
    XCTAssertEqual(deny["decision"] as? String, "DENY")

    let allowRequestId = try XCTUnwrap(allow["requestId"] as? String)
    let logIds = try service.getLogIds()
    XCTAssertFalse(logIds.isEmpty)
    XCTAssertTrue(try service.getLogById(try XCTUnwrap(logIds.first)).hasPrefix("{"))
    XCTAssertFalse(try service.getLogsByRequestId(allowRequestId).isEmpty)
    XCTAssertFalse(try service.getLogsByTag("DEBUG").isEmpty)
    _ = try service.getLogsByRequestIdAndTag(allowRequestId, tag: "DEBUG")

    try service.pushDataContext(
      key: "demo-session",
      valueJson: #"{"platform":"ios"}"#,
      ttlSeconds: 60
    )
    XCTAssertEqual(try service.getDataContext("demo-session"), #"{"platform":"ios"}"#)
    XCTAssertEqual(try service.getDataContextEntry("demo-session")?["key"] as? String, "demo-session")
    XCTAssertFalse(try service.listDataContext().isEmpty)
    XCTAssertEqual(try service.getDataContextStats()["entryCount"] as? Double, 1)
    XCTAssertTrue(try service.removeDataContext("demo-session"))
    try service.pushDataContext(key: "demo-session", valueJson: "true", ttlSeconds: nil)
    try service.clearDataContext()
    XCTAssertTrue(try service.listDataContext().isEmpty)

    XCTAssertFalse(try service.isTrustedIssuerLoadedByName("offline-demo"))
    XCTAssertFalse(try service.isTrustedIssuerLoadedByIssuer("https://invalid.example"))
    XCTAssertEqual(try service.trustedIssuerSummary()["total"] as? Double, 0)

    XCTAssertThrowsError(
      try service.initialize(bootstrapJson: fixture.bootstrap, archiveUri: "/missing/policy.cjar")
    )
    XCTAssertTrue(try service.isInitialized(), "failed replacement must preserve the live instance")

    try service.dispose()
    XCTAssertFalse(try service.isInitialized())
    XCTAssertThrowsError(
      try service.authorizeUnsigned(
        principalJson: fixture.allowPrincipal,
        action: action,
        resourceJson: fixture.resource,
        contextJson: "{}"
      )
    ) { error in
      XCTAssertEqual((error as? CedarlingModuleError)?.code, .notInitialized)
    }

    try service.initialize(
      bootstrapJson: fixture.bootstrap,
      archiveUri: fixture.archive.absoluteString
    )
    XCTAssertTrue(try service.isInitialized())
    try service.dispose()
  }

  func testSerializedConcurrentAuthorizationAndDispose() throws {
    let service = CedarlingService()
    let fixture = try loadFixture()
    try service.initialize(
      bootstrapJson: fixture.bootstrap,
      archiveUri: fixture.archive.absoluteString
    )

    let group = DispatchGroup()
    let lock = NSLock()
    var failures: [Error] = []
    for _ in 0..<8 {
      group.enter()
      service.queue.async {
        defer { group.leave() }
        do {
          let result = try service.authorizeUnsigned(
            principalJson: fixture.allowPrincipal,
            action: self.action,
            resourceJson: fixture.resource,
            contextJson: "{}"
          )
          XCTAssertEqual(result["decision"] as? String, "ALLOW")
        } catch {
          lock.lock()
          failures.append(error)
          lock.unlock()
        }
      }
    }
    XCTAssertEqual(group.wait(timeout: .now() + 30), .success)
    XCTAssertTrue(failures.isEmpty)
    XCTAssertFalse(try service.popLogs().isEmpty)
    XCTAssertTrue(try service.getLogIds().isEmpty)
    try service.dispose()
  }

  private func loadFixture() throws -> Fixture {
    let bundle = Bundle(for: Self.self)
    return Fixture(
      bootstrap: try read("bootstrap", "json", bundle),
      allowPrincipal: try read("allow-principal", "json", bundle),
      denyPrincipal: try read("deny-principal", "json", bundle),
      resource: try read("resource", "json", bundle),
      archive: try XCTUnwrap(bundle.url(forResource: "policy-store", withExtension: "cjar"))
    )
  }

  private func read(_ name: String, _ extensionName: String, _ bundle: Bundle) throws -> String {
    let url = try XCTUnwrap(bundle.url(forResource: name, withExtension: extensionName))
    return try String(contentsOf: url, encoding: .utf8)
  }
}

private struct Fixture {
  let bootstrap: String
  let allowPrincipal: String
  let denyPrincipal: String
  let resource: String
  let archive: URL
}
