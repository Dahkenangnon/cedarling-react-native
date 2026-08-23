package expo.modules.cedarling

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.jans.cedarling.CedarlingAndroid
import uniffi.cedarling_uniffi.Cedarling
import uniffi.cedarling_uniffi.DataEntry
import uniffi.cedarling_uniffi.DataStoreStats
import uniffi.cedarling_uniffi.EntityData
import uniffi.cedarling_uniffi.TokenInput

internal class CedarlingService(context: Context) {
  private val applicationContext = context.applicationContext
  private val mutex = Mutex()
  private val lifecycleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  @Volatile
  private var instance: Cedarling? = null

  @Volatile
  private var lifecycleDisposed = false

  suspend fun initialize(bootstrapJson: String, archiveUri: String?) =
    onIo {
      mutex.withLock {
        ensureUsable()
        CedarlingJson.requireBootstrap(bootstrapJson)
        CedarlingAndroid.ensureInitialized(applicationContext)
        val replacement = try {
          if (archiveUri == null) {
            Cedarling.loadFromJson(bootstrapJson)
          } else {
            val archive = CedarlingArchive.read(applicationContext.contentResolver, archiveUri)
            Cedarling.loadFromJsonWithArchiveBytes(bootstrapJson, archive)
          }
        } catch (error: CedarlingSdkException) {
          throw error
        } catch (error: Exception) {
          throw CedarlingSdkException(
            CedarlingErrorCode.INITIALIZATION,
            error.messageOrFallback("Cedarling initialization failed"),
            error
          )
        }

        val previous = instance
        instance = replacement
        previous?.let(::release)
      }
    }

  suspend fun isInitialized(): Boolean =
    onIo {
      mutex.withLock {
        ensureUsable()
        instance != null
      }
    }

  suspend fun authorizeUnsigned(
    principalJson: String?,
    action: String,
    resourceJson: String,
    contextJson: String
  ): Map<String, Any> =
    onIo {
      mutex.withLock {
        ensureUsable()
        val cedarling = requireInstance()
        CedarlingJson.requireAction(action)
        CedarlingJson.requireContext(contextJson)
        principalJson?.let { CedarlingJson.requireEntity(it, "principal") }
        CedarlingJson.requireEntity(resourceJson, "resource")

        val principal = principalJson?.let(::entityFromJson)
        val resource = entityFromJson(resourceJson)
        try {
          CedarlingResultMapper.map(
            cedarling.authorizeUnsigned(principal, action, resource, contextJson)
          )
        } catch (error: CedarlingSdkException) {
          throw error
        } catch (error: Exception) {
          throw CedarlingSdkException(
            CedarlingErrorCode.AUTHORIZATION,
            error.messageOrFallback("Cedarling authorization failed"),
            error
          )
        } finally {
          principal?.destroy()
          resource.destroy()
        }
      }
    }

  suspend fun authorizeMultiIssuer(
    tokensJson: String,
    action: String,
    resourceJson: String,
    contextJson: String
  ): Map<String, Any> =
    onIo {
      mutex.withLock {
        ensureUsable()
        val cedarling = requireInstance()
        CedarlingJson.requireAction(action)
        CedarlingJson.requireContext(contextJson)
        CedarlingJson.requireEntity(resourceJson, "resource")
        val tokens: List<TokenInput> = CedarlingJson.parseTokens(tokensJson)
        val resource = entityFromJson(resourceJson)
        try {
          CedarlingResultMapper.map(
            cedarling.authorizeMultiIssuer(tokens, action, resource, contextJson)
          )
        } catch (error: CedarlingSdkException) {
          throw error
        } catch (error: Exception) {
          throw CedarlingSdkException(
            CedarlingErrorCode.AUTHORIZATION,
            error.messageOrFallback("Cedarling authorization failed"),
            error
          )
        } finally {
          resource.destroy()
        }
      }
    }

  suspend fun getLogIds(): List<String> = withInstance { it.getLogIds() }

  suspend fun getLogById(id: String): String =
    withLogOperation {
      CedarlingJson.requireNonemptyString(id, "log id")
      it.getLogById(id)
    }

  suspend fun getLogsByRequestId(requestId: String): List<String> =
    withLogOperation {
      CedarlingJson.requireNonemptyString(requestId, "request id")
      it.getLogsByRequestId(requestId)
    }

  suspend fun getLogsByRequestIdAndTag(requestId: String, tag: String): List<String> =
    withLogOperation {
      CedarlingJson.requireNonemptyString(requestId, "request id")
      CedarlingJson.requireNonemptyString(tag, "log tag")
      it.getLogsByRequestIdAndTag(requestId, tag)
    }

  suspend fun getLogsByTag(tag: String): List<String> =
    withLogOperation {
      CedarlingJson.requireNonemptyString(tag, "log tag")
      it.getLogsByTag(tag)
    }

  suspend fun popLogs(): List<String> = withLogOperation { it.popLogs() }

  suspend fun pushDataContext(key: String, valueJson: String, ttlSeconds: Double?) =
    withDataOperation {
      CedarlingJson.requireNonemptyString(key, "data context key")
      CedarlingJson.requireJsonValue(valueJson, "data context value")
      it.pushDataCtx(key, valueJson, validateTtlSeconds(ttlSeconds))
    }

  suspend fun getDataContext(key: String): String? =
    withDataOperation {
      CedarlingJson.requireNonemptyString(key, "data context key")
      it.getDataCtx(key)
    }

  suspend fun getDataContextEntry(key: String): Map<String, Any>? =
    withDataOperation {
      CedarlingJson.requireNonemptyString(key, "data context key")
      it.getDataEntryCtx(key)?.let(::mapDataEntry)
    }

  suspend fun removeDataContext(key: String): Boolean =
    withDataOperation {
      CedarlingJson.requireNonemptyString(key, "data context key")
      it.removeDataCtx(key)
    }

  suspend fun clearDataContext() = withDataOperation { it.clearDataCtx() }

  suspend fun listDataContext(): List<Map<String, Any>> =
    withDataOperation { cedarling -> cedarling.listDataCtx().map(::mapDataEntry) }

  suspend fun getDataContextStats(): Map<String, Any> =
    withDataOperation { mapDataStoreStats(it.getStatsCtx()) }

  suspend fun isTrustedIssuerLoadedByName(name: String): Boolean =
    withInstance {
      CedarlingJson.requireNonemptyString(name, "trusted issuer name")
      it.isTrustedIssuerLoadedByName(name)
    }

  suspend fun isTrustedIssuerLoadedByIssuer(issuer: String): Boolean =
    withInstance {
      CedarlingJson.requireNonemptyString(issuer, "trusted issuer URL")
      it.isTrustedIssuerLoadedByIss(issuer)
    }

  suspend fun trustedIssuerSummary(): Map<String, Any> =
    withInstance {
      mapOf(
        "total" to it.totalIssuers().toDouble(),
        "loaded" to it.loadedTrustedIssuersCount().toDouble(),
        "loadedIds" to it.loadedTrustedIssuerIds(),
        "failedIds" to it.failedTrustedIssuerIds()
      )
    }

  suspend fun dispose() =
    onIo {
      mutex.withLock {
        ensureUsable()
        instance?.let(::release)
        instance = null
      }
    }

  fun disposeFromLifecycle() {
    lifecycleDisposed = true
    lifecycleScope.launch {
      mutex.withLock {
        instance?.let(::release)
        instance = null
      }
    }
  }

  fun nativeInfo(): Map<String, Any> {
    ensureUsable()
    return mapOf(
      "sdkVersion" to CedarlingProvenance.SDK_VERSION,
      "cedarlingRevision" to CedarlingProvenance.CEDARLING_REVISION,
      "cedarlingCrateVersion" to CedarlingProvenance.CEDARLING_CRATE_VERSION,
      "uniffiVersion" to CedarlingProvenance.UNIFFI_VERSION,
      "abis" to CedarlingProvenance.SUPPORTED_ABIS
    )
  }

  private fun ensureUsable() {
    if (lifecycleDisposed) {
      throw CedarlingSdkException(
        CedarlingErrorCode.ALREADY_DISPOSED,
        "Cedarling module has been destroyed"
      )
    }
  }

  private fun requireInstance(): Cedarling =
    instance ?: throw CedarlingSdkException(
      CedarlingErrorCode.NOT_INITIALIZED,
      "Cedarling has not been initialized"
    )

  private fun entityFromJson(json: String): EntityData =
    try {
      EntityData.fromJson(json)
    } catch (error: Exception) {
      throw CedarlingSdkException(
        CedarlingErrorCode.INVALID_INPUT,
        error.messageOrFallback("entity conversion failed"),
        error
      )
    }

  private fun release(cedarling: Cedarling) {
    try {
      cedarling.shutDown()
    } catch (_: Exception) {
      // Lifetime release must continue even if optional connection shutdown fails.
    } finally {
      cedarling.destroy()
    }
  }

  private suspend fun <T> withInstance(operation: (Cedarling) -> T): T =
    onIo {
      mutex.withLock {
        ensureUsable()
        operation(requireInstance())
      }
    }

  private suspend fun <T> withLogOperation(operation: (Cedarling) -> T): T =
    try {
      withInstance(operation)
    } catch (error: CedarlingSdkException) {
      throw error
    } catch (error: Exception) {
      throw CedarlingSdkException(
        CedarlingErrorCode.LOGGING,
        error.messageOrFallback("Cedarling log operation failed"),
        error
      )
    }

  private suspend fun <T> withDataOperation(operation: (Cedarling) -> T): T =
    try {
      withInstance(operation)
    } catch (error: CedarlingSdkException) {
      throw error
    } catch (error: Exception) {
      throw CedarlingSdkException(
        CedarlingErrorCode.DATA_CONTEXT,
        error.messageOrFallback("Cedarling data-context operation failed"),
        error
      )
    }

  private fun validateTtlSeconds(value: Double?): Long? {
    if (value == null) {
      return null
    }
    if (!value.isFinite() || value < 0 || value % 1.0 != 0.0 || value > 9_007_199_254_740_991.0) {
      throw CedarlingSdkException(
        CedarlingErrorCode.INVALID_INPUT,
        "ttlSeconds must be a non-negative safe integer"
      )
    }
    return value.toLong()
  }

  private fun mapDataEntry(entry: DataEntry): Map<String, Any> =
    mapOf(
      "key" to entry.key,
      "valueJson" to entry.value,
      "dataType" to entry.dataType,
      "createdAt" to entry.createdAt,
      "expiresAt" to entry.expiresAt,
      "accessCount" to entry.accessCount.toDouble()
    )

  private fun mapDataStoreStats(stats: DataStoreStats): Map<String, Any> =
    mapOf(
      "entryCount" to stats.entryCount.toDouble(),
      "maxEntries" to stats.maxEntries.toDouble(),
      "maxEntrySize" to stats.maxEntrySize.toDouble(),
      "metricsEnabled" to stats.metricsEnabled,
      "totalSizeBytes" to stats.totalSizeBytes.toDouble(),
      "averageEntrySizeBytes" to stats.avgEntrySizeBytes.toDouble(),
      "capacityUsagePercent" to stats.capacityUsagePercent,
      "memoryAlertThreshold" to stats.memoryAlertThreshold,
      "memoryAlertTriggered" to stats.memoryAlertTriggered
    )

  private suspend fun <T> onIo(block: suspend () -> T): T =
    withContext(Dispatchers.IO) { block() }
}
