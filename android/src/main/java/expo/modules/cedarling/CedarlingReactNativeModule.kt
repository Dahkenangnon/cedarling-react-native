package expo.modules.cedarling

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CedarlingReactNativeModule : Module() {
  @Volatile
  private var service: CedarlingService? = null

  override fun definition() = ModuleDefinition {
    Name("CedarlingReactNative")

    AsyncFunction("initialize") Coroutine {
        bootstrapJson: String,
        archiveUri: String? ->
      requireService().initialize(bootstrapJson, archiveUri)
    }

    AsyncFunction("isInitialized") Coroutine { ->
      requireService().isInitialized()
    }

    AsyncFunction("authorizeUnsigned") Coroutine {
        principalJson: String?,
        action: String,
        resourceJson: String,
        contextJson: String ->
      requireService().authorizeUnsigned(principalJson, action, resourceJson, contextJson)
    }

    AsyncFunction("authorizeMultiIssuer") Coroutine {
        tokensJson: String,
        action: String,
        resourceJson: String,
        contextJson: String ->
      requireService().authorizeMultiIssuer(tokensJson, action, resourceJson, contextJson)
    }

    AsyncFunction("getLogIds") Coroutine { -> requireService().getLogIds() }
    AsyncFunction("getLogById") Coroutine { id: String -> requireService().getLogById(id) }
    AsyncFunction("getLogsByRequestId") Coroutine { requestId: String ->
      requireService().getLogsByRequestId(requestId)
    }
    AsyncFunction("getLogsByRequestIdAndTag") Coroutine { requestId: String, tag: String ->
      requireService().getLogsByRequestIdAndTag(requestId, tag)
    }
    AsyncFunction("getLogsByTag") Coroutine { tag: String ->
      requireService().getLogsByTag(tag)
    }
    AsyncFunction("popLogs") Coroutine { -> requireService().popLogs() }

    AsyncFunction("pushDataContext") Coroutine {
        key: String,
        valueJson: String,
        ttlSeconds: Double? ->
      requireService().pushDataContext(key, valueJson, ttlSeconds)
    }
    AsyncFunction("getDataContext") Coroutine { key: String ->
      requireService().getDataContext(key)
    }
    AsyncFunction("getDataContextEntry") Coroutine { key: String ->
      requireService().getDataContextEntry(key)
    }
    AsyncFunction("removeDataContext") Coroutine { key: String ->
      requireService().removeDataContext(key)
    }
    AsyncFunction("clearDataContext") Coroutine { -> requireService().clearDataContext() }
    AsyncFunction("listDataContext") Coroutine { -> requireService().listDataContext() }
    AsyncFunction("getDataContextStats") Coroutine { ->
      requireService().getDataContextStats()
    }

    AsyncFunction("isTrustedIssuerLoadedByName") Coroutine { name: String ->
      requireService().isTrustedIssuerLoadedByName(name)
    }
    AsyncFunction("isTrustedIssuerLoadedByIssuer") Coroutine { issuer: String ->
      requireService().isTrustedIssuerLoadedByIssuer(issuer)
    }
    AsyncFunction("getTrustedIssuerSummary") Coroutine { ->
      requireService().trustedIssuerSummary()
    }

    AsyncFunction("dispose") Coroutine { ->
      requireService().dispose()
    }

    AsyncFunction("getNativeInfo") Coroutine { ->
      requireService().nativeInfo()
    }

    OnDestroy {
      service?.disposeFromLifecycle()
      service = null
    }
  }

  private fun requireService(): CedarlingService {
    service?.let { return it }
    return synchronized(this) {
      service ?: CedarlingService(
        requireNotNull(appContext.reactContext) {
          "React application context is unavailable"
        }.applicationContext
      ).also { service = it }
    }
  }
}
