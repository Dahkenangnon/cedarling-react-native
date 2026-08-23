import XCTest

final class CedarlingReactNativeExampleUITests: XCTestCase {
  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  override func tearDownWithError() throws {
    if testRun?.hasSucceeded == false {
      attachScreenshot(named: "cedarling-ui-failure")
    }
  }

  func testRealNativeAllowDenyAndReinitialize() throws {
    let app = XCUIApplication()
    app.launch()

    let runButton = app.buttons["run-native-smoke-tests"]
    XCTAssertTrue(runButton.waitForExistence(timeout: 15))
    scrollToHittable(runButton, in: app)
    runButton.tap()

    let pass = NSPredicate(format: "label == 'PASS'")
    expectation(for: pass, evaluatedWith: app.staticTexts["overall-status-value"])
    waitForExpectations(timeout: 60)
    XCTAssertEqual(app.staticTexts["overall-status-value"].label, "PASS")
    XCTAssertEqual(app.staticTexts["allow-result-decision"].label, "ALLOW")
    XCTAssertEqual(app.staticTexts["deny-result-decision"].label, "DENY")
    XCTAssertEqual(
      app.staticTexts["smoke-evidence-summary"].label,
      "ALLOW request: ALLOW · DENY request: DENY"
    )
    XCTAssertTrue(app.staticTexts["allow-result-reasons"].label.contains("allow_reader"))
    XCTAssertEqual(app.staticTexts["completed-runs-value"].label, "1")

    let reinitializeButton = app.buttons["dispose-and-reinitialize"]
    XCTAssertTrue(reinitializeButton.isEnabled)
    scrollToHittable(reinitializeButton, in: app)
    reinitializeButton.tap()
    let secondRun = NSPredicate(format: "label == '2'")
    expectation(for: secondRun, evaluatedWith: app.staticTexts["completed-runs-value"])
    waitForExpectations(timeout: 60)
    XCTAssertEqual(app.staticTexts["overall-status-value"].label, "PASS")
    XCTAssertFalse(app.otherElements["smoke-error"].exists)
    attachScreenshot(named: "cedarling-ui-success")
  }

  private func scrollToHittable(_ element: XCUIElement, in app: XCUIApplication) {
    for _ in 0..<8 where !element.isHittable {
      app.swipeUp()
    }
    XCTAssertTrue(element.isHittable)
  }

  private func attachScreenshot(named name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
