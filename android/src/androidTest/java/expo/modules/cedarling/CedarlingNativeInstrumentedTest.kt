package expo.modules.cedarling

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.File
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import org.jans.cedarling.CedarlingAndroid
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CedarlingNativeInstrumentedTest {
  private val context = ApplicationProvider.getApplicationContext<Context>()
  private val bootstrap =
    context.assets.open("bootstrap.json").bufferedReader().use { it.readText() }
  private val allowPrincipal =
    """{"cedar_entity_mapping":{"entity_type":"ReactNativeExample::User","id":"alice"},"role":"reader"}"""
  private val denyPrincipal =
    """{"cedar_entity_mapping":{"entity_type":"ReactNativeExample::User","id":"mallory"},"role":"guest"}"""
  private val resource =
    """{"cedar_entity_mapping":{"entity_type":"ReactNativeExample::Document","id":"document-1"}}"""
  private val action = """ReactNativeExample::Action::"Read""""

  @Test
  fun realNativeLifecycleAndDecisions() = runBlocking {
    CedarlingAndroid.ensureInitialized(context.applicationContext)
    CedarlingAndroid.ensureInitialized(context.applicationContext)

    val beforeInitialization = CedarlingService(context)
    assertSdkCode(CedarlingErrorCode.NOT_INITIALIZED) {
      beforeInitialization.authorizeUnsigned(allowPrincipal, action, resource, "{}")
    }

    val archive = copyAsset("policy-store.cjar")
    val service = CedarlingService(context)
    service.initialize(bootstrap, archive.toURI().toString())
    assertTrue(service.isInitialized())

    val allow = service.authorizeUnsigned(allowPrincipal, action, resource, "{}")
    assertDecision(allow, expectedAllowed = true, expectedDecision = "ALLOW")
    val deny = service.authorizeUnsigned(denyPrincipal, action, resource, "{}")
    assertDecision(deny, expectedAllowed = false, expectedDecision = "DENY")

    assertSdkCode(CedarlingErrorCode.INVALID_JSON) {
      service.authorizeUnsigned(allowPrincipal, action, resource, "{")
    }

    val invalidArchive = File(context.cacheDir, "invalid-policy.cjar")
    invalidArchive.writeBytes(byteArrayOf(1, 2, 3, 4))
    assertSdkCode(CedarlingErrorCode.INITIALIZATION) {
      service.initialize(bootstrap, invalidArchive.toURI().toString())
    }
    assertDecision(
      service.authorizeUnsigned(allowPrincipal, action, resource, "{}"),
      expectedAllowed = true,
      expectedDecision = "ALLOW"
    )

    val concurrent = coroutineScope {
      List(12) { index ->
        async {
          val expectsAllow = index % 2 == 0
          val principal = if (expectsAllow) allowPrincipal else denyPrincipal
          service.authorizeUnsigned(principal, action, resource, "{}") to expectsAllow
        }
      }.awaitAll()
    }
    for ((result, expectsAllow) in concurrent) {
      assertEquals(expectsAllow, result["allowed"])
    }

    service.dispose()
    assertFalse(service.isInitialized())
    service.initialize(bootstrap, archive.toURI().toString())
    assertDecision(
      service.authorizeUnsigned(denyPrincipal, action, resource, "{}"),
      expectedAllowed = false,
      expectedDecision = "DENY"
    )
    service.dispose()
  }

  private fun copyAsset(name: String): File =
    File(context.cacheDir, name).also { destination ->
      context.assets.open(name).use { input ->
        destination.outputStream().use(input::copyTo)
      }
    }

  private fun assertDecision(
    result: Map<String, Any>,
    expectedAllowed: Boolean,
    expectedDecision: String
  ) {
    assertEquals(expectedAllowed, result["allowed"])
    assertEquals(expectedDecision, result["decision"])
    assertTrue((result["requestId"] as String).isNotBlank())
    @Suppress("UNCHECKED_CAST")
    val diagnostics = result["diagnostics"] as? Map<String, Any>
    assertNotNull(diagnostics)
    assertTrue(diagnostics?.get("reasons") is List<*>)
    assertTrue(diagnostics?.get("errors") is List<*>)
  }

  private suspend fun assertSdkCode(
    expectedCode: String,
    block: suspend () -> Unit
  ) {
    val error = try {
      block()
      null
    } catch (caught: CedarlingSdkException) {
      caught
    }
    assertNotNull("Expected CedarlingSdkException", error)
    assertEquals(expectedCode, error?.code)
  }
}
