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

  private suspend fun <T> onIo(block: suspend () -> T): T =
    withContext(Dispatchers.IO) { block() }
}
