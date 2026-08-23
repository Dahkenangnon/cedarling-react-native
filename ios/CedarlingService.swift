import Foundation

internal final class CedarlingService {
  let queue = DispatchQueue(label: "com.cedarling.react-native.service", qos: .userInitiated)

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

  func getLogIds() throws -> [String] {
    try withInstance { $0.getLogIds() }
  }

  func getLogById(_ id: String) throws -> String {
    try withLogOperation {
      _ = try CedarlingJson.requireNonemptyString(id, label: "log id")
      return try $0.getLogById(id: id)
    }
  }

  func getLogsByRequestId(_ requestId: String) throws -> [String] {
    try withLogOperation {
      _ = try CedarlingJson.requireNonemptyString(requestId, label: "request id")
      return try $0.getLogsByRequestId(requestId: requestId)
    }
  }

  func getLogsByRequestIdAndTag(_ requestId: String, tag: String) throws -> [String] {
    try withLogOperation {
      _ = try CedarlingJson.requireNonemptyString(requestId, label: "request id")
      _ = try CedarlingJson.requireNonemptyString(tag, label: "log tag")
      return try $0.getLogsByRequestIdAndTag(requestId: requestId, tag: tag)
    }
  }

  func getLogsByTag(_ tag: String) throws -> [String] {
    try withLogOperation {
      _ = try CedarlingJson.requireNonemptyString(tag, label: "log tag")
      return try $0.getLogsByTag(tag: tag)
    }
  }

  func popLogs() throws -> [String] {
    try withLogOperation { try $0.popLogs() }
  }

  func pushDataContext(key: String, valueJson: String, ttlSeconds: Double?) throws {
    try withDataOperation {
      _ = try CedarlingJson.requireNonemptyString(key, label: "data context key")
      try CedarlingJson.requireJsonValue(valueJson, label: "data context value")
      try $0.pushDataCtx(
        key: key,
        value: valueJson,
        ttlSecs: try validateTtlSeconds(ttlSeconds)
      )
    }
  }

  func getDataContext(_ key: String) throws -> String? {
    try withDataOperation {
      _ = try CedarlingJson.requireNonemptyString(key, label: "data context key")
      return try $0.getDataCtx(key: key)
    }
  }

  func getDataContextEntry(_ key: String) throws -> [String: Any]? {
    try withDataOperation {
      _ = try CedarlingJson.requireNonemptyString(key, label: "data context key")
      return try $0.getDataEntryCtx(key: key).map(mapDataEntry)
    }
  }

  func removeDataContext(_ key: String) throws -> Bool {
    try withDataOperation {
      _ = try CedarlingJson.requireNonemptyString(key, label: "data context key")
      return try $0.removeDataCtx(key: key)
    }
  }

  func clearDataContext() throws {
    try withDataOperation { try $0.clearDataCtx() }
  }

  func listDataContext() throws -> [[String: Any]] {
    try withDataOperation { try $0.listDataCtx().map(mapDataEntry) }
  }

  func getDataContextStats() throws -> [String: Any] {
    try withDataOperation { mapDataStoreStats(try $0.getStatsCtx()) }
  }

  func isTrustedIssuerLoadedByName(_ name: String) throws -> Bool {
    try withInstance {
      _ = try CedarlingJson.requireNonemptyString(name, label: "trusted issuer name")
      return $0.isTrustedIssuerLoadedByName(issuerId: name)
    }
  }

  func isTrustedIssuerLoadedByIssuer(_ issuer: String) throws -> Bool {
    try withInstance {
      _ = try CedarlingJson.requireNonemptyString(issuer, label: "trusted issuer URL")
      return $0.isTrustedIssuerLoadedByIss(issClaim: issuer)
    }
  }

  func trustedIssuerSummary() throws -> [String: Any] {
    try withInstance {
      [
        "total": Double($0.totalIssuers()),
        "loaded": Double($0.loadedTrustedIssuersCount()),
        "loadedIds": $0.loadedTrustedIssuerIds(),
        "failedIds": $0.failedTrustedIssuerIds()
      ]
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

  private func withInstance<T>(_ operation: (Cedarling) throws -> T) throws -> T {
    try ensureUsable()
    return try operation(requireInstance())
  }

  private func withLogOperation<T>(_ operation: (Cedarling) throws -> T) throws -> T {
    do {
      return try withInstance(operation)
    } catch let error as CedarlingModuleError {
      throw error
    } catch {
      throw CedarlingModuleError(.logging, "Cedarling log operation failed")
    }
  }

  private func withDataOperation<T>(_ operation: (Cedarling) throws -> T) throws -> T {
    do {
      return try withInstance(operation)
    } catch let error as CedarlingModuleError {
      throw error
    } catch {
      throw CedarlingModuleError(.dataContext, "Cedarling data-context operation failed")
    }
  }

  private func validateTtlSeconds(_ value: Double?) throws -> Int64? {
    guard let value else {
      return nil
    }
    guard value.isFinite,
          value >= 0,
          value.rounded(.towardZero) == value,
          value <= 9_007_199_254_740_991 else {
      throw CedarlingModuleError(
        .invalidInput,
        "ttlSeconds must be a non-negative safe integer"
      )
    }
    return Int64(value)
  }

  private func mapDataEntry(_ entry: DataEntry) -> [String: Any] {
    [
      "key": entry.key,
      "valueJson": entry.value,
      "dataType": entry.dataType,
      "createdAt": entry.createdAt,
      "expiresAt": entry.expiresAt,
      "accessCount": Double(entry.accessCount)
    ]
  }

  private func mapDataStoreStats(_ stats: DataStoreStats) -> [String: Any] {
    [
      "entryCount": Double(stats.entryCount),
      "maxEntries": Double(stats.maxEntries),
      "maxEntrySize": Double(stats.maxEntrySize),
      "metricsEnabled": stats.metricsEnabled,
      "totalSizeBytes": Double(stats.totalSizeBytes),
      "averageEntrySizeBytes": Double(stats.avgEntrySizeBytes),
      "capacityUsagePercent": stats.capacityUsagePercent,
      "memoryAlertThreshold": stats.memoryAlertThreshold,
      "memoryAlertTriggered": stats.memoryAlertTriggered
    ]
  }
}
