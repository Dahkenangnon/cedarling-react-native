package expo.modules.cedarling

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@ReactModule(name = CedarlingReactNativeModule.NAME)
internal class CedarlingReactNativeModule(reactContext: ReactApplicationContext) :
  NativeCedarlingReactNativeSpec(reactContext) {
  private val service = CedarlingService(reactContext)
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private val gson = Gson()

  override fun initialize(bootstrapJson: String, archiveUri: String?, promise: Promise) =
    execute(promise) { service.initialize(bootstrapJson, archiveUri) }

  override fun isInitialized(promise: Promise) =
    execute(promise) { service.isInitialized() }

  override fun authorizeUnsigned(
    principalJson: String?,
    action: String,
    resourceJson: String,
    contextJson: String,
    promise: Promise
  ) = executeJson(promise) {
    service.authorizeUnsigned(principalJson, action, resourceJson, contextJson)
  }

  override fun authorizeMultiIssuer(
    tokensJson: String,
    action: String,
    resourceJson: String,
    contextJson: String,
    promise: Promise
  ) = executeJson(promise) {
    service.authorizeMultiIssuer(tokensJson, action, resourceJson, contextJson)
  }

  override fun getLogIds(promise: Promise) =
    executeJson(promise) { service.getLogIds() }

  override fun getLogById(id: String, promise: Promise) =
    execute(promise) { service.getLogById(id) }

  override fun getLogsByRequestId(requestId: String, promise: Promise) =
    executeJson(promise) { service.getLogsByRequestId(requestId) }

  override fun getLogsByRequestIdAndTag(requestId: String, tag: String, promise: Promise) =
    executeJson(promise) { service.getLogsByRequestIdAndTag(requestId, tag) }

  override fun getLogsByTag(tag: String, promise: Promise) =
    executeJson(promise) { service.getLogsByTag(tag) }

  override fun popLogs(promise: Promise) =
    executeJson(promise) { service.popLogs() }

  override fun pushDataContext(
    key: String,
    valueJson: String,
    ttlSeconds: Double?,
    promise: Promise
  ) = execute(promise) { service.pushDataContext(key, valueJson, ttlSeconds) }

  override fun getDataContext(key: String, promise: Promise) =
    execute(promise) { service.getDataContext(key) ?: "null" }

  override fun getDataContextEntry(key: String, promise: Promise) =
    executeJson(promise) { service.getDataContextEntry(key) }

  override fun removeDataContext(key: String, promise: Promise) =
    execute(promise) { service.removeDataContext(key) }

  override fun clearDataContext(promise: Promise) =
    execute(promise) { service.clearDataContext() }

  override fun listDataContext(promise: Promise) =
    executeJson(promise) { service.listDataContext() }

  override fun getDataContextStats(promise: Promise) =
    executeJson(promise) { service.getDataContextStats() }

  override fun isTrustedIssuerLoadedByName(name: String, promise: Promise) =
    execute(promise) { service.isTrustedIssuerLoadedByName(name) }

  override fun isTrustedIssuerLoadedByIssuer(issuer: String, promise: Promise) =
    execute(promise) { service.isTrustedIssuerLoadedByIssuer(issuer) }

  override fun getTrustedIssuerSummary(promise: Promise) =
    executeJson(promise) { service.trustedIssuerSummary() }

  override fun dispose(promise: Promise) =
    execute(promise) { service.dispose() }

  override fun getNativeInfo(promise: Promise) =
    executeJson(promise) { service.nativeInfo() }

  override fun invalidate() {
    service.disposeFromLifecycle()
    scope.cancel()
    super.invalidate()
  }

  private fun executeJson(promise: Promise, operation: suspend () -> Any?) =
    execute(promise) { gson.toJson(operation()) }

  private fun execute(promise: Promise, operation: suspend () -> Any?) {
    scope.launch {
      try {
        promise.resolve(operation())
      } catch (error: CedarlingSdkException) {
        promise.reject(error.code, error.message, error)
      } catch (error: Throwable) {
        promise.reject(
          CedarlingErrorCode.NATIVE,
          "Cedarling native operation failed",
          error
        )
      }
    }
  }

  companion object {
    const val NAME = NativeCedarlingReactNativeSpec.NAME
  }
}
