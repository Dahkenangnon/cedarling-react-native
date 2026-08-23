import Foundation

public typealias CedarlingBridgeCompletion =
  @convention(block) (Any?, NSString?, NSString?) -> Void

/// Swift owner for the serialized Cedarling service. The Objective-C++
/// TurboModule only forwards Codegen calls and React Native promise blocks.
@objc(CedarlingReactNativeBridge)
public final class CedarlingReactNativeBridge: NSObject {
  private let service = CedarlingService()

  @objc(initializeWithBootstrapJson:archiveUri:completion:)
  public func initialize(
    _ bootstrapJson: String,
    archiveUri: String?,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    perform(completion) {
      try self.service.initialize(bootstrapJson: bootstrapJson, archiveUri: archiveUri)
      return nil
    }
  }

  @objc(isInitializedWithCompletion:)
  public func isInitialized(completion: @escaping CedarlingBridgeCompletion) {
    perform(completion) { try self.service.isInitialized() }
  }

  @objc(authorizeUnsignedWithPrincipalJson:action:resourceJson:contextJson:completion:)
  public func authorizeUnsigned(
    principalJson: String?,
    action: String,
    resourceJson: String,
    contextJson: String,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    performJson(completion) {
      try self.service.authorizeUnsigned(
        principalJson: principalJson,
        action: action,
        resourceJson: resourceJson,
        contextJson: contextJson
      )
    }
  }

  @objc(authorizeMultiIssuerWithTokensJson:action:resourceJson:contextJson:completion:)
  public func authorizeMultiIssuer(
    tokensJson: String,
    action: String,
    resourceJson: String,
    contextJson: String,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    performJson(completion) {
      try self.service.authorizeMultiIssuer(
        tokensJson: tokensJson,
        action: action,
        resourceJson: resourceJson,
        contextJson: contextJson
      )
    }
  }

  @objc(getLogIdsWithCompletion:)
  public func getLogIds(completion: @escaping CedarlingBridgeCompletion) {
    performJson(completion) { try self.service.getLogIds() }
  }

  @objc(getLogById:completion:)
  public func getLogById(_ id: String, completion: @escaping CedarlingBridgeCompletion) {
    perform(completion) { try self.service.getLogById(id) }
  }

  @objc(getLogsByRequestId:completion:)
  public func getLogsByRequestId(
    _ requestId: String,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    performJson(completion) { try self.service.getLogsByRequestId(requestId) }
  }

  @objc(getLogsByRequestId:tag:completion:)
  public func getLogsByRequestIdAndTag(
    _ requestId: String,
    tag: String,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    performJson(completion) { try self.service.getLogsByRequestIdAndTag(requestId, tag: tag) }
  }

  @objc(getLogsByTag:completion:)
  public func getLogsByTag(_ tag: String, completion: @escaping CedarlingBridgeCompletion) {
    performJson(completion) { try self.service.getLogsByTag(tag) }
  }

  @objc(popLogsWithCompletion:)
  public func popLogs(completion: @escaping CedarlingBridgeCompletion) {
    performJson(completion) { try self.service.popLogs() }
  }

  @objc(pushDataContextWithKey:valueJson:ttlSeconds:completion:)
  public func pushDataContext(
    key: String,
    valueJson: String,
    ttlSeconds: NSNumber?,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    perform(completion) {
      try self.service.pushDataContext(
        key: key,
        valueJson: valueJson,
        ttlSeconds: ttlSeconds?.doubleValue
      )
      return nil
    }
  }

  @objc(getDataContextWithKey:completion:)
  public func getDataContext(
    key: String,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    perform(completion) { try self.service.getDataContext(key) ?? "null" }
  }

  @objc(getDataContextEntryWithKey:completion:)
  public func getDataContextEntry(
    key: String,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    performJson(completion) { try self.service.getDataContextEntry(key) ?? NSNull() }
  }

  @objc(removeDataContextWithKey:completion:)
  public func removeDataContext(
    key: String,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    perform(completion) { try self.service.removeDataContext(key) }
  }

  @objc(clearDataContextWithCompletion:)
  public func clearDataContext(completion: @escaping CedarlingBridgeCompletion) {
    perform(completion) {
      try self.service.clearDataContext()
      return nil
    }
  }

  @objc(listDataContextWithCompletion:)
  public func listDataContext(completion: @escaping CedarlingBridgeCompletion) {
    performJson(completion) { try self.service.listDataContext() }
  }

  @objc(getDataContextStatsWithCompletion:)
  public func getDataContextStats(completion: @escaping CedarlingBridgeCompletion) {
    performJson(completion) { try self.service.getDataContextStats() }
  }

  @objc(isTrustedIssuerLoadedByName:completion:)
  public func isTrustedIssuerLoadedByName(
    _ name: String,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    perform(completion) { try self.service.isTrustedIssuerLoadedByName(name) }
  }

  @objc(isTrustedIssuerLoadedByIssuer:completion:)
  public func isTrustedIssuerLoadedByIssuer(
    _ issuer: String,
    completion: @escaping CedarlingBridgeCompletion
  ) {
    perform(completion) { try self.service.isTrustedIssuerLoadedByIssuer(issuer) }
  }

  @objc(getTrustedIssuerSummaryWithCompletion:)
  public func getTrustedIssuerSummary(completion: @escaping CedarlingBridgeCompletion) {
    performJson(completion) { try self.service.trustedIssuerSummary() }
  }

  @objc(disposeWithCompletion:)
  public func dispose(completion: @escaping CedarlingBridgeCompletion) {
    perform(completion) {
      try self.service.dispose()
      return nil
    }
  }

  @objc(getNativeInfoWithCompletion:)
  public func getNativeInfo(completion: @escaping CedarlingBridgeCompletion) {
    performJson(completion) { try self.service.nativeInfo() }
  }

  @objc
  public func invalidate() {
    service.disposeFromLifecycle()
  }

  private func performJson(
    _ completion: @escaping CedarlingBridgeCompletion,
    operation: @escaping () throws -> Any
  ) {
    perform(completion) { try Self.encodeJson(operation()) }
  }

  private func perform(
    _ completion: @escaping CedarlingBridgeCompletion,
    operation: @escaping () throws -> Any?
  ) {
    service.queue.async {
      do {
        completion(try operation(), nil, nil)
      } catch let error as CedarlingModuleError {
        completion(nil, error.code.rawValue as NSString, error.message as NSString)
      } catch {
        completion(
          nil,
          CedarlingErrorCode.native.rawValue as NSString,
          "Cedarling native operation failed" as NSString
        )
      }
    }
  }

  private static func encodeJson(_ value: Any) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed])
    guard let json = String(data: data, encoding: .utf8) else {
      throw CedarlingModuleError(.nativeResultInconsistent, "Native result is not UTF-8 JSON")
    }
    return json
  }
}
