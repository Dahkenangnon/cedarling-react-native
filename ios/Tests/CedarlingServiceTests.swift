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
