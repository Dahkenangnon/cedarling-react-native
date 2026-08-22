import XCTest
@testable import CedarlingReactNative

final class CedarlingResultMapperTests: XCTestCase {
  func testMapsConsistentAllowResult() throws {
    let mapped = try CedarlingResultMapper.map(
      allowed: true,
      decision: .allow,
      requestId: "request-1",
      diagnostics: Diagnostics(reasons: ["allow_reader"], errors: [])
    )
    XCTAssertEqual(mapped["allowed"] as? Bool, true)
    XCTAssertEqual(mapped["decision"] as? String, "ALLOW")
    XCTAssertEqual(mapped["requestId"] as? String, "request-1")
  }

  func testRejectsInconsistentOrIncompleteResults() {
    XCTAssertThrowsError(
      try CedarlingResultMapper.map(
        allowed: false,
        decision: .allow,
        requestId: "request-1",
        diagnostics: Diagnostics(reasons: [], errors: [])
      )
    ) { error in
      XCTAssertEqual(
        (error as? CedarlingModuleError)?.code,
        .nativeResultInconsistent
      )
    }

    XCTAssertThrowsError(
      try CedarlingResultMapper.map(
        allowed: false,
        decision: .deny,
        requestId: "   ",
        diagnostics: Diagnostics(reasons: [], errors: [])
      )
    )
  }
}
