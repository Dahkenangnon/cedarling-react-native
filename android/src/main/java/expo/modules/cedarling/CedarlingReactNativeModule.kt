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
