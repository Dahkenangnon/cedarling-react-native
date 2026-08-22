package expo.modules.cedarling

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import uniffi.cedarling_uniffi.Decision
import uniffi.cedarling_uniffi.Diagnostics

class CedarlingResultMapperTest {
  @Test
  fun mapsAllowAndDiagnostics() {
    val result = CedarlingResultMapper.map(
      allowed = true,
      decision = Decision.ALLOW,
      requestId = "request-1",
      diagnostics = Diagnostics(listOf("allow_reader"), emptyList())
    )
    assertEquals(true, result["allowed"])
    assertEquals("ALLOW", result["decision"])
    assertEquals("request-1", result["requestId"])
    @Suppress("UNCHECKED_CAST")
    val diagnostics = result["diagnostics"] as Map<String, List<String>>
    assertEquals(listOf("allow_reader"), diagnostics["reasons"])
  }

  @Test
  fun rejectsDecisionDisagreementAndEmptyRequestId() {
    val inconsistent = assertThrows(CedarlingSdkException::class.java) {
      CedarlingResultMapper.map(false, Decision.ALLOW, "request-1", Diagnostics(emptyList(), emptyList()))
    }
    assertEquals(CedarlingErrorCode.NATIVE_RESULT_INCONSISTENT, inconsistent.code)

    val emptyId = assertThrows(CedarlingSdkException::class.java) {
      CedarlingResultMapper.map(false, Decision.DENY, "", Diagnostics(emptyList(), emptyList()))
    }
    assertEquals(CedarlingErrorCode.NATIVE_RESULT_INCONSISTENT, emptyId.code)
  }
}
