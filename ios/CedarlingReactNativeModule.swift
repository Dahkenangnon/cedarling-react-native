import ExpoModulesCore

public final class CedarlingReactNativeModule: Module {
  private let service = CedarlingService()

  public func definition() -> ModuleDefinition {
    Name("CedarlingReactNative")

    AsyncFunction("initialize") { [service]
      (bootstrapJson: String, archiveUri: String?) throws in
      try Self.bridge {
        try service.initialize(bootstrapJson: bootstrapJson, archiveUri: archiveUri)
      }
    }
    .runOnQueue(service.queue)

    AsyncFunction("isInitialized") { [service] () throws -> Bool in
      try Self.bridge { try service.isInitialized() }
    }
    .runOnQueue(service.queue)

    AsyncFunction("authorizeUnsigned") { [service]
      (
        principalJson: String?,
        action: String,
        resourceJson: String,
        contextJson: String
      ) throws -> [String: Any] in
      try Self.bridge {
        try service.authorizeUnsigned(
          principalJson: principalJson,
          action: action,
          resourceJson: resourceJson,
          contextJson: contextJson
        )
      }
    }
    .runOnQueue(service.queue)

    AsyncFunction("authorizeMultiIssuer") { [service]
      (
        tokensJson: String,
        action: String,
        resourceJson: String,
        contextJson: String
      ) throws -> [String: Any] in
      try Self.bridge {
        try service.authorizeMultiIssuer(
          tokensJson: tokensJson,
          action: action,
          resourceJson: resourceJson,
          contextJson: contextJson
        )
      }
    }
    .runOnQueue(service.queue)

    AsyncFunction("getLogIds") { [service] () throws -> [String] in
      try Self.bridge { try service.getLogIds() }
    }
    .runOnQueue(service.queue)

    AsyncFunction("getLogById") { [service] (id: String) throws -> String in
      try Self.bridge { try service.getLogById(id) }
    }
    .runOnQueue(service.queue)

    AsyncFunction("getLogsByRequestId") { [service] (requestId: String) throws -> [String] in
      try Self.bridge { try service.getLogsByRequestId(requestId) }
    }
    .runOnQueue(service.queue)

    AsyncFunction("getLogsByRequestIdAndTag") { [service]
      (requestId: String, tag: String) throws -> [String] in
      try Self.bridge { try service.getLogsByRequestIdAndTag(requestId, tag: tag) }
    }
    .runOnQueue(service.queue)

    AsyncFunction("getLogsByTag") { [service] (tag: String) throws -> [String] in
      try Self.bridge { try service.getLogsByTag(tag) }
    }
    .runOnQueue(service.queue)

    AsyncFunction("popLogs") { [service] () throws -> [String] in
      try Self.bridge { try service.popLogs() }
    }
    .runOnQueue(service.queue)

    AsyncFunction("pushDataContext") { [service]
      (key: String, valueJson: String, ttlSeconds: Double?) throws in
      try Self.bridge {
        try service.pushDataContext(key: key, valueJson: valueJson, ttlSeconds: ttlSeconds)
      }
    }
    .runOnQueue(service.queue)

    AsyncFunction("getDataContext") { [service] (key: String) throws -> String? in
      try Self.bridge { try service.getDataContext(key) }
    }
    .runOnQueue(service.queue)

    AsyncFunction("getDataContextEntry") { [service]
      (key: String) throws -> [String: Any]? in
      try Self.bridge { try service.getDataContextEntry(key) }
    }
    .runOnQueue(service.queue)

    AsyncFunction("removeDataContext") { [service] (key: String) throws -> Bool in
      try Self.bridge { try service.removeDataContext(key) }
    }
    .runOnQueue(service.queue)

    AsyncFunction("clearDataContext") { [service] in
      try Self.bridge { try service.clearDataContext() }
    }
    .runOnQueue(service.queue)

    AsyncFunction("listDataContext") { [service] () throws -> [[String: Any]] in
      try Self.bridge { try service.listDataContext() }
    }
    .runOnQueue(service.queue)

    AsyncFunction("getDataContextStats") { [service] () throws -> [String: Any] in
      try Self.bridge { try service.getDataContextStats() }
    }
    .runOnQueue(service.queue)

    AsyncFunction("isTrustedIssuerLoadedByName") { [service] (name: String) throws -> Bool in
      try Self.bridge { try service.isTrustedIssuerLoadedByName(name) }
    }
    .runOnQueue(service.queue)

    AsyncFunction("isTrustedIssuerLoadedByIssuer") { [service] (issuer: String) throws -> Bool in
      try Self.bridge { try service.isTrustedIssuerLoadedByIssuer(issuer) }
    }
    .runOnQueue(service.queue)

    AsyncFunction("getTrustedIssuerSummary") { [service] () throws -> [String: Any] in
      try Self.bridge { try service.trustedIssuerSummary() }
    }
    .runOnQueue(service.queue)

    AsyncFunction("dispose") { [service] in
      try Self.bridge { try service.dispose() }
    }
    .runOnQueue(service.queue)

    AsyncFunction("getNativeInfo") { [service] () throws -> [String: Any] in
      try Self.bridge { try service.nativeInfo() }
    }
    .runOnQueue(service.queue)

    OnDestroy { [service] in
      service.disposeFromLifecycle()
    }
  }

  private static func bridge<T>(_ operation: () throws -> T) throws -> T {
    do {
      return try operation()
    } catch let error as CedarlingModuleError {
      throw Exception(
        name: "CedarlingSdkException",
        description: error.message,
        code: error.code.rawValue
      )
    } catch {
      throw Exception(
        name: "CedarlingSdkException",
        description: "Cedarling native operation failed",
        code: CedarlingErrorCode.native.rawValue
      )
    }
  }
}
