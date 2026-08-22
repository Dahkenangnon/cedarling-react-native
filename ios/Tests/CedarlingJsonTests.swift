import XCTest
@testable import CedarlingReactNative

final class CedarlingJsonTests: XCTestCase {
  func testStableErrorCodes() {
    XCTAssertEqual(CedarlingErrorCode.alreadyDisposed.rawValue, "E_ALREADY_DISPOSED")
    XCTAssertEqual(CedarlingErrorCode.notInitialized.rawValue, "E_NOT_INITIALIZED")
    XCTAssertEqual(CedarlingErrorCode.invalidInput.rawValue, "E_INVALID_INPUT")
    XCTAssertEqual(CedarlingErrorCode.invalidJson.rawValue, "E_INVALID_JSON")
    XCTAssertEqual(CedarlingErrorCode.archiveIo.rawValue, "E_ARCHIVE_IO")
    XCTAssertEqual(CedarlingErrorCode.archiveTooLarge.rawValue, "E_ARCHIVE_TOO_LARGE")
    XCTAssertEqual(CedarlingErrorCode.initialization.rawValue, "E_INITIALIZATION")
    XCTAssertEqual(CedarlingErrorCode.authorization.rawValue, "E_AUTHORIZATION")
    XCTAssertEqual(
      CedarlingErrorCode.nativeResultInconsistent.rawValue,
      "E_NATIVE_RESULT_INCONSISTENT"
    )
    XCTAssertEqual(CedarlingErrorCode.native.rawValue, "E_NATIVE")
  }

  func testValidatesEntityAndContext() throws {
    XCTAssertNoThrow(
      try CedarlingJson.requireEntity(
        """
        {
          "cedar_entity_mapping": {
            "entity_type": "Example::User",
            "id": "alice"
          }
        }
        """,
        label: "principal"
      )
    )
    XCTAssertNoThrow(try CedarlingJson.requireContext("{}"))
  }

  func testRejectsMalformedOrIncompleteInput() {
    assertCode(.invalidJson) {
      _ = try CedarlingJson.requireBootstrap("[]")
    }
    assertCode(.invalidInput) {
      _ = try CedarlingJson.requireEntity("{}", label: "resource")
    }
    assertCode(.invalidInput) {
      _ = try CedarlingJson.requireAction("  ")
    }
  }

  func testParsesTokens() throws {
    let tokens = try CedarlingJson.parseTokens(
      #"[{"mapping":"Jans::Access_Token","payload":"header.payload.signature"}]"#
    )
    XCTAssertEqual(tokens.count, 1)
    XCTAssertEqual(tokens[0].mapping, "Jans::Access_Token")
    XCTAssertEqual(tokens[0].payload, "header.payload.signature")
  }

  private func assertCode(
    _ expected: CedarlingErrorCode,
    operation: () throws -> Void
  ) {
    XCTAssertThrowsError(try operation()) { error in
      XCTAssertEqual((error as? CedarlingModuleError)?.code, expected)
    }
  }
}
