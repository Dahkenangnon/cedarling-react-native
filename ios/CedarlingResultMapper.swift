import Foundation

internal enum CedarlingResultMapper {
  static func map(_ result: AuthorizeResult) throws -> [String: Any] {
    try map(
      allowed: result.decision,
      decision: result.response.decision,
      requestId: result.requestId,
      diagnostics: result.response.diagnostics
    )
  }

  static func map(_ result: MultiIssuerAuthorizeResult) throws -> [String: Any] {
    try map(
      allowed: result.decision,
      decision: result.response.decision,
      requestId: result.requestId,
      diagnostics: result.response.diagnostics
    )
  }

  static func map(
    allowed: Bool,
    decision: Decision,
    requestId: String,
    diagnostics: Diagnostics
  ) throws -> [String: Any] {
    let decisionName: String
    switch decision {
    case .allow:
      decisionName = "ALLOW"
    case .deny:
      decisionName = "DENY"
    }

    guard allowed == (decisionName == "ALLOW") else {
      throw CedarlingModuleError(
        .nativeResultInconsistent,
        "native Boolean and Cedar decision disagree"
      )
    }
    guard !requestId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw CedarlingModuleError(
        .nativeResultInconsistent,
        "native result has an empty request ID"
      )
    }
    return [
      "allowed": allowed,
      "decision": decisionName,
      "requestId": requestId,
      "diagnostics": [
        "reasons": Array(diagnostics.reasons),
        "errors": Array(diagnostics.errors)
      ]
    ]
  }
}
