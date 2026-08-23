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
