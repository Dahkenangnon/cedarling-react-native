import Foundation

internal final class CedarlingService {
  let queue = DispatchQueue(label: "expo.modules.cedarling.service", qos: .userInitiated)

  private var instance: Cedarling?
  private var lifecycleDisposed = false

  func initialize(bootstrapJson: String, archiveUri: String?) throws {
    try ensureUsable()
    try CedarlingJson.requireBootstrap(bootstrapJson)

    let replacement: Cedarling
    do {
      if let archiveUri {
        let archive = try CedarlingArchive.read(archiveUri)
        replacement = try Cedarling.loadFromJsonWithArchiveBytes(
          config: bootstrapJson,
          archiveBytes: archive
        )
      } else {
        replacement = try Cedarling.loadFromJson(config: bootstrapJson)
      }
    } catch let error as CedarlingModuleError {
      throw error
    } catch {
      throw CedarlingModuleError(.initialization, "Cedarling initialization failed")
    }

    let previous = instance
    instance = replacement
    release(previous)
  }

  func isInitialized() throws -> Bool {
    try ensureUsable()
    return instance != nil
  }

  func authorizeUnsigned(
    principalJson: String?,
    action: String,
    resourceJson: String,
    contextJson: String
  ) throws -> [String: Any] {
    try ensureUsable()
    let cedarling = try requireInstance()
    let validatedAction = try CedarlingJson.requireAction(action)
    try CedarlingJson.requireContext(contextJson)
    if let principalJson {
      try CedarlingJson.requireEntity(principalJson, label: "principal")
    }
    try CedarlingJson.requireEntity(resourceJson, label: "resource")

    do {
      let principal = try principalJson.map(entityFromJson)
      let resource = try entityFromJson(resourceJson)
      let context = JsonValue(contextJson)
      return try CedarlingResultMapper.map(
        cedarling.authorizeUnsigned(
          principal: principal,
          action: validatedAction,
          resource: resource,
          context: context
        )
      )
    } catch let error as CedarlingModuleError {
      throw error
    } catch {
      throw CedarlingModuleError(.authorization, "Cedarling authorization failed")
    }
  }

  func authorizeMultiIssuer(
    tokensJson: String,
    action: String,
    resourceJson: String,
    contextJson: String
  ) throws -> [String: Any] {
    try ensureUsable()
    let cedarling = try requireInstance()
    let validatedAction = try CedarlingJson.requireAction(action)
    try CedarlingJson.requireContext(contextJson)
    try CedarlingJson.requireEntity(resourceJson, label: "resource")
    let tokens = try CedarlingJson.parseTokens(tokensJson)

    do {
      let resource = try entityFromJson(resourceJson)
      let context = JsonValue(contextJson)
      return try CedarlingResultMapper.map(
        cedarling.authorizeMultiIssuer(
          tokens: tokens,
          action: validatedAction,
          resource: resource,
          context: context
        )
      )
    } catch let error as CedarlingModuleError {
      throw error
    } catch {
      throw CedarlingModuleError(.authorization, "Cedarling authorization failed")
    }
  }

  func dispose() throws {
    try ensureUsable()
    let previous = instance
    instance = nil
    release(previous)
  }

  func nativeInfo() throws -> [String: Any] {
    try ensureUsable()
    return [
      "sdkVersion": CedarlingProvenance.sdkVersion,
      "cedarlingRevision": CedarlingProvenance.cedarlingRevision,
      "cedarlingCrateVersion": CedarlingProvenance.cedarlingCrateVersion,
      "uniffiVersion": CedarlingProvenance.uniffiVersion,
      "abis": CedarlingProvenance.supportedArchitectures
    ]
  }

  func disposeFromLifecycle() {
    queue.async { [self] in
      lifecycleDisposed = true
      let previous = instance
      instance = nil
      release(previous)
    }
  }

  private func ensureUsable() throws {
    if lifecycleDisposed {
      throw CedarlingModuleError(.alreadyDisposed, "Cedarling module has been destroyed")
    }
  }

  private func requireInstance() throws -> Cedarling {
    guard let instance else {
      throw CedarlingModuleError(.notInitialized, "Cedarling has not been initialized")
    }
    return instance
  }

  private func entityFromJson(_ json: String) throws -> EntityData {
    do {
      return try EntityData.fromJson(jsonString: json)
    } catch {
      throw CedarlingModuleError(.invalidInput, "entity conversion failed")
    }
  }

  private func release(_ cedarling: Cedarling?) {
    cedarling?.shutDown()
  }
}
