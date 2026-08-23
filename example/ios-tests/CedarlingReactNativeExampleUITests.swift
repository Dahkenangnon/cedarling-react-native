import XCTest

final class CedarlingReactNativeExampleUITests: XCTestCase {
  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  func testRealNativeAllowDenyAndReinitialize() throws {
    let app = XCUIApplication()
    app.launch()

    let runButton = app.buttons["run-native-smoke-tests"]
    XCTAssertTrue(runButton.waitForExistence(timeout: 15))
    runButton.tap()

    let pass = NSPredicate(format: "label == 'PASS'")
    expectation(for: pass, evaluatedWith: app.staticTexts["overall-status-value"])
    waitForExpectations(timeout: 60)
    XCTAssertEqual(app.staticTexts["overall-status-value"].label, "PASS")
    XCTAssertEqual(app.staticTexts["allow-result-decision"].label, "ALLOW")
    XCTAssertEqual(app.staticTexts["deny-result-decision"].label, "DENY")
    XCTAssertTrue(app.staticTexts["allow-result-reasons"].label.contains("allow_reader"))
    XCTAssertEqual(app.staticTexts["completed-runs-value"].label, "1")

    let reinitializeButton = app.buttons["dispose-and-reinitialize"]
    XCTAssertTrue(reinitializeButton.isEnabled)
    reinitializeButton.tap()
    let secondRun = NSPredicate(format: "label == '2'")
    expectation(for: secondRun, evaluatedWith: app.staticTexts["completed-runs-value"])
    waitForExpectations(timeout: 60)
    XCTAssertEqual(app.staticTexts["overall-status-value"].label, "PASS")
    XCTAssertFalse(app.otherElements["smoke-error"].exists)
  }
}
