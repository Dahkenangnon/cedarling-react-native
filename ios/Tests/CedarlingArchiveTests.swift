import Foundation
import XCTest
@testable import CedarlingReactNative

final class CedarlingArchiveTests: XCTestCase {
  func testReadsFileUriAndAbsolutePath() throws {
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension("cjar")
    let expected = Data("fixture".utf8)
    try expected.write(to: url)
    defer { try? FileManager.default.removeItem(at: url) }

    XCTAssertEqual(try CedarlingArchive.read(url.absoluteString), expected)
    XCTAssertEqual(try CedarlingArchive.read(url.path), expected)
  }

  func testRejectsRemoteAndRelativeLocations() {
    assertCode(.invalidInput) {
      _ = try CedarlingArchive.read("https://example.com/policy.cjar")
    }
    assertCode(.invalidInput) {
      _ = try CedarlingArchive.read("policy.cjar")
    }
    assertCode(.invalidInput) {
      _ = try CedarlingArchive.read("file:///tmp/policy.cjar?version=1")
    }
  }

  func testEnforcesArchiveLimitWhileReading() throws {
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension("cjar")
    try Data(repeating: 0x41, count: cedarlingMaximumArchiveBytes + 1).write(to: url)
    defer { try? FileManager.default.removeItem(at: url) }

    assertCode(.archiveTooLarge) {
      _ = try CedarlingArchive.read(url.path)
    }
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
